import "server-only";
import { TRADE_LIMITS, type FriendCollection, type TradeResult, type TradesOverview } from "@/lib/multi/trades";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { exchangeAccessFor } from "./exchange";
import { notifyFrom } from "./push";

type Tx = Prisma.TransactionClient;
const DAY = 86_400_000;

async function areFriends(a: string, b: string): Promise<boolean> {
  const link = await db().friendship.findFirst({
    where: {
      status: "accepted",
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
    select: { id: true },
  });
  return !!link;
}

/** Collection d'un ami : seul un ami peut la consulter. */
export async function friendCollection(userId: string, friendId: string): Promise<FriendCollection | null> {
  if (!(await areFriends(userId, friendId))) return null;
  const friend = await db().user.findUnique({
    where: { id: friendId },
    select: { id: true, username: true, collection: { select: { characterId: true, count: true, golden: true } } },
  });
  if (!friend) return null;
  return {
    id: friend.id,
    username: friend.username,
    collection: Object.fromEntries(friend.collection.map((e) => [e.characterId, { count: e.count, golden: e.golden }])),
  };
}

export async function tradesOverview(userId: string): Promise<TradesOverview> {
  const [trades, access] = await Promise.all([
    db().trade.findMany({
      where: { status: "pending", OR: [{ fromId: userId }, { toId: userId }] },
      include: { from: { select: { username: true } }, to: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
    }),
    exchangeAccessFor(userId),
  ]);
  const view = (trade: (typeof trades)[number], friend: string) => ({
    id: trade.id,
    friend,
    offeredId: trade.offeredId,
    offeredGolden: trade.offeredGolden,
    requestedId: trade.requestedId,
    requestedGolden: trade.requestedGolden,
    createdAt: trade.createdAt.getTime(),
  });
  return {
    incoming: trades.filter((t) => t.toId === userId).map((t) => view(t, t.from.username)),
    outgoing: trades.filter((t) => t.fromId === userId).map((t) => view(t, t.to.username)),
    access,
  };
}

/** Ce qui empêche ces deux comptes d'échanger, le cas échéant : l'un d'eux n'a pas encore assez joué. */
async function lockedFor(userId: string, friendId: string): Promise<"locked" | "friend-locked" | null> {
  const [mine, theirs] = await Promise.all([exchangeAccessFor(userId), exchangeAccessFor(friendId)]);
  return !mine.open ? "locked" : !theirs.open ? "friend-locked" : null;
}

/** Le joueur a-t-il un exemplaire de cette version de l'avis : doré, ou ordinaire. */
async function owns(userId: string, characterId: string, golden: boolean): Promise<boolean> {
  const entry = await db().collectionEntry.findUnique({ where: { userId_characterId: { userId, characterId } } });
  return !!entry && hasCopy(entry, golden);
}

const hasCopy = (entry: { count: number; golden: number }, golden: boolean) =>
  golden ? entry.golden > 0 : entry.count - entry.golden > 0;

/**
 * Propose à un ami d'échanger un de ses avis contre un des siens, chacun dans
 * sa version ordinaire ou dorée. Rien ne bouge tant qu'il n'a pas accepté.
 */
export async function proposeTrade(
  userId: string,
  friendId: string,
  offered: { id: string; golden: boolean },
  requested: { id: string; golden: boolean },
): Promise<TradeResult> {
  const { id: offeredId, golden: offeredGolden } = offered;
  const { id: requestedId, golden: requestedGolden } = requested;
  if (offeredId === requestedId && offeredGolden === requestedGolden) return { ok: false, error: "same" };
  if (!(await areFriends(userId, friendId))) return { ok: false, error: "not-friends" };
  const locked = await lockedFor(userId, friendId);
  if (locked) return { ok: false, error: locked };
  if (!(await owns(userId, offeredId, offeredGolden))) return { ok: false, error: "not-owned" };
  if (!(await owns(friendId, requestedId, requestedGolden))) return { ok: false, error: "friend-not-owned" };

  const [same, pending, today] = await Promise.all([
    db().trade.count({
      where: { fromId: userId, toId: friendId, offeredId, offeredGolden, requestedId, requestedGolden, status: "pending" },
    }),
    db().trade.count({ where: { fromId: userId, status: "pending" } }),
    db().trade.count({ where: { fromId: userId, createdAt: { gte: new Date(Date.now() - DAY) } } }),
  ]);
  if (same > 0) return { ok: false, error: "already" };
  if (pending >= TRADE_LIMITS.pending || today >= TRADE_LIMITS.perDay) return { ok: false, error: "limit" };

  await db().trade.create({ data: { fromId: userId, toId: friendId, offeredId, offeredGolden, requestedId, requestedGolden } });
  await notifyFrom(friendId, userId, (from) => ({ type: "trade-proposed", from }));
  return { ok: true };
}

class Gone extends Error {}

/**
 * Retire à un joueur l'exemplaire promis d'un avis, ordinaire ou doré : s'il ne
 * l'a plus, l'échange tombe. Sans autre exemplaire, l'avis quitte aussi son équipage.
 */
async function takeCopy(tx: Tx, userId: string, characterId: string, golden: boolean) {
  const entry = await tx.collectionEntry.findUnique({ where: { userId_characterId: { userId, characterId } } });
  if (!entry || !hasCopy(entry, golden)) throw new Gone();

  // L'avis doit être resté tel qu'on l'a lu : deux échanges simultanés ne donnent pas deux fois le même exemplaire
  const where = { userId, characterId, count: entry.count, golden: entry.golden };
  if (entry.count === 1) {
    const removed = await tx.collectionEntry.deleteMany({ where });
    if (removed.count === 0) throw new Gone();
    await tx.crewSlot.deleteMany({ where: { userId, characterId } });
  } else {
    const updated = await tx.collectionEntry.updateMany({
      where,
      data: { count: { decrement: 1 }, golden: { decrement: golden ? 1 : 0 } },
    });
    if (updated.count === 0) throw new Gone();
  }
}

async function giveCopy(tx: Tx, userId: string, characterId: string, golden: boolean) {
  await tx.collectionEntry.upsert({
    where: { userId_characterId: { userId, characterId } },
    create: { userId, characterId, count: 1, golden: golden ? 1 : 0 },
    update: { count: { increment: 1 }, golden: { increment: golden ? 1 : 0 } },
  });
}

/** Réponse à une proposition reçue. Acceptée, les deux avis changent de collection d'un seul tenant. */
export async function answerTrade(userId: string, tradeId: string, accept: boolean): Promise<TradeResult> {
  const trade = await db().trade.findFirst({ where: { id: tradeId, toId: userId, status: "pending" } });
  if (!trade) return { ok: false, error: "not-found" };
  const close = (status: string) =>
    db().trade.updateMany({ where: { id: trade.id, status: "pending" }, data: { status, answeredAt: new Date() } });

  if (!accept) {
    const declined = await close("declined");
    if (declined.count > 0) await notifyFrom(trade.fromId, userId, (from) => ({ type: "trade-declined", from }));
    return { ok: true };
  }
  if (!(await areFriends(userId, trade.fromId))) {
    await close("cancelled");
    return { ok: false, error: "not-friends" };
  }
  // Revérifié à l'acceptation : une proposition d'avant le garde-fou ne le contourne pas
  const locked = await lockedFor(userId, trade.fromId);
  if (locked) return { ok: false, error: locked };

  try {
    await db().$transaction(async (tx) => {
      const closed = await tx.trade.updateMany({
        where: { id: trade.id, status: "pending" },
        data: { status: "accepted", answeredAt: new Date() },
      });
      if (closed.count === 0) throw new Gone();
      await takeCopy(tx, trade.fromId, trade.offeredId, trade.offeredGolden);
      await takeCopy(tx, userId, trade.requestedId, trade.requestedGolden);
      await giveCopy(tx, userId, trade.offeredId, trade.offeredGolden);
      await giveCopy(tx, trade.fromId, trade.requestedId, trade.requestedGolden);
    });
  } catch (error) {
    if (!(error instanceof Gone)) throw error;
    await close("cancelled");
    return { ok: false, error: "gone" };
  }
  await notifyFrom(trade.fromId, userId, (from) => ({ type: "trade-accepted", from }));
  return { ok: true };
}

/** Annule une proposition envoyée et restée sans réponse. */
export async function cancelTrade(userId: string, tradeId: string): Promise<TradeResult> {
  const cancelled = await db().trade.updateMany({
    where: { id: tradeId, fromId: userId, status: "pending" },
    data: { status: "cancelled", answeredAt: new Date() },
  });
  return cancelled.count > 0 ? { ok: true } : { ok: false, error: "not-found" };
}
