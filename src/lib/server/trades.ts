import "server-only";
import {
  normalizeTradeSide,
  TRADE_HISTORY_SHOWN,
  TRADE_LIMITS,
  tradeLineKey,
  type FriendCollection,
  type TradeHistoryEntry,
  type TradeLine,
  type TradeResult,
  type TradesOverview,
} from "@/lib/multi/trades";
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
  const include = { from: { select: { username: true } }, to: { select: { username: true } }, items: true };
  const [trades, closed, access] = await Promise.all([
    db().trade.findMany({
      where: { status: "pending", OR: [{ fromId: userId }, { toId: userId }] },
      include,
      orderBy: { createdAt: "desc" },
    }),
    db().trade.findMany({
      where: { status: { not: "pending" }, OR: [{ fromId: userId }, { toId: userId }] },
      include,
      orderBy: { answeredAt: "desc" },
      take: TRADE_HISTORY_SHOWN,
    }),
    exchangeAccessFor(userId),
  ]);
  const view = (trade: (typeof trades)[number]) => ({
    id: trade.id,
    friend: trade.fromId === userId ? trade.to.username : trade.from.username,
    ...sides(trade.items),
    createdAt: trade.createdAt.getTime(),
  });
  return {
    incoming: trades.filter((t) => t.toId === userId).map(view),
    outgoing: trades.filter((t) => t.fromId === userId).map(view),
    history: closed.map((trade) => ({
      ...view(trade),
      status: trade.status as TradeHistoryEntry["status"],
      answeredAt: (trade.answeredAt ?? trade.createdAt).getTime(),
      mine: trade.fromId === userId,
      fresh: trade.fromId === userId && trade.seenAt === null,
    })),
    access,
  };
}

/** Issues de ses propositions que le joueur n'a pas encore vues, pour la cloche de l'en-tête. */
export function unseenTradeAnswers(userId: string): Promise<number> {
  return db().trade.count({ where: { fromId: userId, status: { not: "pending" }, seenAt: null } });
}

/** Le joueur a vu l'issue de ses propositions : la cloche ne les compte plus. */
export async function acknowledgeTrades(userId: string): Promise<void> {
  await db().trade.updateMany({ where: { fromId: userId, status: { not: "pending" }, seenAt: null }, data: { seenAt: new Date() } });
}

/** Ce qui empêche ces deux comptes d'échanger, le cas échéant : l'un d'eux n'a pas encore assez joué. */
async function lockedFor(userId: string, friendId: string): Promise<"locked" | "friend-locked" | null> {
  const [mine, theirs] = await Promise.all([exchangeAccessFor(userId), exchangeAccessFor(friendId)]);
  return !mine.open ? "locked" : !theirs.open ? "friend-locked" : null;
}

type Item = { side: string; characterId: string; golden: boolean; count: number };

/** Les deux côtés d'un échange tel qu'il est rangé en base, dans un ordre stable. */
function sides(items: Item[]): { offered: TradeLine[]; requested: TradeLine[] } {
  const side = (name: string) =>
    items
      .filter((item) => item.side === name)
      .map((item) => ({ id: item.characterId, golden: item.golden, count: item.count }))
      .sort((a, b) => tradeLineKey(a).localeCompare(tradeLineKey(b)));
  return { offered: side("offered"), requested: side("requested") };
}

const available = (entry: { count: number; golden: number }, golden: boolean) =>
  golden ? entry.golden : entry.count - entry.golden;

/** Le joueur a-t-il assez d'exemplaires de chaque version demandée, ordinaire ou dorée. */
async function ownsAll(userId: string, lines: TradeLine[]): Promise<boolean> {
  const entries = await db().collectionEntry.findMany({
    where: { userId, characterId: { in: lines.map((line) => line.id) } },
  });
  return lines.every((line) => {
    const entry = entries.find((e) => e.characterId === line.id);
    return !!entry && available(entry, line.golden) >= line.count;
  });
}

const signature = (side: { offered: TradeLine[]; requested: TradeLine[] }) => JSON.stringify(side);

/**
 * Propose à un ami d'échanger quelques-uns de ses avis contre quelques-uns des
 * siens, chacun dans sa version ordinaire ou dorée. Rien ne bouge tant qu'il n'a pas accepté.
 */
export async function proposeTrade(userId: string, friendId: string, offeredLines: unknown, requestedLines: unknown): Promise<TradeResult> {
  const offered = normalizeTradeSide(offeredLines);
  const requested = normalizeTradeSide(requestedLines);
  if (!offered || !requested) return { ok: false, error: "bad-size" };
  const given = new Set(offered.map(tradeLineKey));
  if (requested.some((line) => given.has(tradeLineKey(line)))) return { ok: false, error: "same" };
  if (!(await areFriends(userId, friendId))) return { ok: false, error: "not-friends" };
  const locked = await lockedFor(userId, friendId);
  if (locked) return { ok: false, error: locked };
  if (!(await ownsAll(userId, offered))) return { ok: false, error: "not-owned" };
  if (!(await ownsAll(friendId, requested))) return { ok: false, error: "friend-not-owned" };

  const [open, today] = await Promise.all([
    db().trade.findMany({ where: { fromId: userId, status: "pending" }, select: { toId: true, items: true } }),
    db().trade.count({ where: { fromId: userId, createdAt: { gte: new Date(Date.now() - DAY) } } }),
  ]);
  const wanted = signature({ offered, requested });
  if (open.some((trade) => trade.toId === friendId && signature(sides(trade.items)) === wanted)) return { ok: false, error: "already" };
  if (open.length >= TRADE_LIMITS.pending || today >= TRADE_LIMITS.perDay) return { ok: false, error: "limit" };

  const items = [
    ...offered.map((line) => ({ side: "offered", characterId: line.id, golden: line.golden, count: line.count })),
    ...requested.map((line) => ({ side: "requested", characterId: line.id, golden: line.golden, count: line.count })),
  ];
  await db().trade.create({ data: { fromId: userId, toId: friendId, items: { create: items } } });
  await notifyFrom(friendId, userId, (from) => ({ type: "trade-proposed", from }));
  return { ok: true };
}

class Gone extends Error {}

/**
 * Retire à un joueur les exemplaires promis d'un avis, ordinaires ou dorés : s'il
 * ne les a plus, l'échange tombe. Sans autre exemplaire, l'avis quitte aussi son équipage.
 */
async function takeCopies(tx: Tx, userId: string, { id: characterId, golden, count }: TradeLine) {
  const entry = await tx.collectionEntry.findUnique({ where: { userId_characterId: { userId, characterId } } });
  if (!entry || available(entry, golden) < count) throw new Gone();

  // L'avis doit être resté tel qu'on l'a lu : deux échanges simultanés ne donnent pas deux fois le même exemplaire
  const where = { userId, characterId, count: entry.count, golden: entry.golden };
  if (entry.count === count) {
    const removed = await tx.collectionEntry.deleteMany({ where });
    if (removed.count === 0) throw new Gone();
    await tx.crewSlot.deleteMany({ where: { userId, characterId } });
  } else {
    const updated = await tx.collectionEntry.updateMany({
      where,
      data: { count: { decrement: count }, golden: { decrement: golden ? count : 0 } },
    });
    if (updated.count === 0) throw new Gone();
  }
}

async function giveCopies(tx: Tx, userId: string, { id: characterId, golden, count }: TradeLine) {
  await tx.collectionEntry.upsert({
    where: { userId_characterId: { userId, characterId } },
    create: { userId, characterId, count, golden: golden ? count : 0 },
    update: { count: { increment: count }, golden: { increment: golden ? count : 0 } },
  });
}

/** Réponse à une proposition reçue. Acceptée, tous les avis changent de collection d'un seul tenant. */
export async function answerTrade(userId: string, tradeId: string, accept: boolean): Promise<TradeResult> {
  const trade = await db().trade.findFirst({ where: { id: tradeId, toId: userId, status: "pending" }, include: { items: true } });
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
      const { offered, requested } = sides(trade.items);
      for (const line of offered) await takeCopies(tx, trade.fromId, line);
      for (const line of requested) await takeCopies(tx, userId, line);
      for (const line of offered) await giveCopies(tx, userId, line);
      for (const line of requested) await giveCopies(tx, trade.fromId, line);
    });
  } catch (error) {
    if (!(error instanceof Gone)) throw error;
    await close("cancelled");
    return { ok: false, error: "gone" };
  }
  await notifyFrom(trade.fromId, userId, (from) => ({ type: "trade-accepted", from }));
  return { ok: true };
}

/** Annule une proposition envoyée et restée sans réponse. Son auteur le sait : rien de neuf à lui montrer. */
export async function cancelTrade(userId: string, tradeId: string): Promise<TradeResult> {
  const now = new Date();
  const cancelled = await db().trade.updateMany({
    where: { id: tradeId, fromId: userId, status: "pending" },
    data: { status: "cancelled", answeredAt: now, seenAt: now },
  });
  return cancelled.count > 0 ? { ok: true } : { ok: false, error: "not-found" };
}
