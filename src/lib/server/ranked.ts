import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { dailyKey } from "@/games/engine/daily";
import { MIX_SLUGS } from "@/games/qcm/logic";
import { sanitizeCosmetics } from "@/lib/economy";
import type { Locale } from "@/lib/i18n";
import { nameKey, randomCode } from "@/lib/multi/rules";
import {
  applyDelta,
  canPair,
  COUNTDOWN_SECONDS,
  duelOutcome,
  MAX_PAIR_DUELS_PER_DAY,
  QUEUE_PRESENCE_SECONDS,
  RANKED_SETTINGS,
  ratingDelta,
  rollSeason,
  seasonDaysLeft,
  seasonKey,
  type RankedProfile,
} from "@/lib/ranked/rules";
import type { QueueStatus, RankedOverview, RoomRankedView, SeasonRecap } from "@/lib/ranked/types";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { grantCosmeticTo, isUniqueViolation, type Tx } from "./player";
import type { SessionUser } from "./session";

const LEADERBOARD_SIZE = 50;
const HISTORY_SIZE = 10;
/** Durée au-delà de laquelle un duel est forcément terminé, même si plus personne ne le regarde. */
export const DUEL_MAX_MS = 5 * 60_000;

/**
 * Profil classé du joueur pour la saison en cours. S'il date d'une saison
 * passée, elle est soldée ici : prime de ligue, bilan gardé, cote rapprochée
 * de la cote de départ. Aucune tâche ne tourne en fin de mois : chaque joueur
 * change de saison à son retour.
 */
async function ensureSeason(tx: Tx, userId: string, season: string): Promise<{ profile: RankedProfile; recap: SeasonRecap | null }> {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { rating: true, rankedSeason: true, rankedGames: true, rankedWins: true },
  });
  const current: RankedProfile = { season: user.rankedSeason, rating: user.rating, games: user.rankedGames, wins: user.rankedWins };
  const { profile, result } = rollSeason(current, season);
  if (profile === current) return { profile, recap: null };

  const berrys = result?.berrys ?? 0;
  // La saison notée sert de verrou : deux requêtes simultanées ne soldent pas deux fois la même
  const rolled = await tx.user.updateMany({
    where: { id: userId, rankedSeason: user.rankedSeason },
    data: {
      rating: profile.rating,
      rankedSeason: season,
      rankedGames: 0,
      rankedWins: 0,
      berrys: { increment: berrys },
      lifetimeBerrys: { increment: berrys },
    },
  });
  if (rolled.count === 0) return ensureSeason(tx, userId, season);

  if (result) {
    await tx.rankedSeasonResult.upsert({
      where: { userId_season: { userId, season: result.season } },
      create: { userId, season: result.season, rating: result.rating, games: result.games, wins: result.wins, berrys },
      update: {},
    });
    if (result.cosmetic) await grantCosmeticTo(tx, userId, result.cosmetic);
  }
  return { profile, recap: result };
}

export async function rankedOverview(user: SessionUser): Promise<RankedOverview> {
  const today = dailyKey();
  const season = seasonKey(today);
  const { profile, recap } = await db().$transaction((tx) => ensureSeason(tx, user.id, season));
  const inSeason = { rankedSeason: season, rankedGames: { gt: 0 } } satisfies Prisma.UserWhereInput;

  const [top, ahead, matches] = await Promise.all([
    db().user.findMany({
      where: inSeason,
      orderBy: [{ rating: "desc" }, { rankedWins: "desc" }, { createdAt: "asc" }],
      take: LEADERBOARD_SIZE,
      select: { id: true, username: true, rating: true, rankedGames: true, rankedWins: true, cosmetics: true, equipped: true },
    }),
    profile.games > 0 ? db().user.count({ where: { ...inSeason, rating: { gt: profile.rating } } }) : null,
    db().rankedMatch.findMany({
      where: { OR: [{ playerAId: user.id }, { playerBId: user.id }] },
      orderBy: { createdAt: "desc" },
      take: HISTORY_SIZE,
    }),
  ]);

  return {
    season,
    daysLeft: seasonDaysLeft(today),
    profile,
    yourRank: ahead === null ? null : ahead + 1,
    leaderboard: top.map((row, index) => ({
      rank: index + 1,
      username: row.username,
      rating: row.rating,
      games: row.rankedGames,
      wins: row.rankedWins,
      you: row.id === user.id,
      look: sanitizeCosmetics(row.cosmetics, row.equipped).equipped,
    })),
    history: matches.map((match) => {
      const first = match.playerAId === user.id;
      const [yourScore, theirScore] = first ? [match.scoreA, match.scoreB] : [match.scoreB, match.scoreA];
      return {
        id: match.id,
        opponent: first ? match.nameB : match.nameA,
        outcome: yourScore > theirScore ? "win" : yourScore < theirScore ? "loss" : "draw",
        yourScore,
        theirScore,
        delta: first ? match.deltaA : match.deltaB,
        createdAt: match.createdAt.getTime(),
      };
    }),
    recap,
  };
}

// ---------------------------------------------------------------------------
// File d'attente

type QueueRow = { userId: string; lang: string; rating: number; joinedAt: Date };
class Taken extends Error {}

const presentSince = () => new Date(Date.now() - QUEUE_PRESENCE_SECONDS * 1000);

/** Code du duel classé en cours du joueur, s'il en a un : il y retrouve sa place au lieu d'en chercher un autre. */
async function runningDuel(userId: string): Promise<string | null> {
  const seat = await db().roomPlayer.findFirst({
    where: { userId, room: { kind: "ranked", status: "playing", createdAt: { gte: new Date(Date.now() - DUEL_MAX_MS) } } },
    orderBy: { joinedAt: "desc" },
    select: { room: { select: { code: true } } },
  });
  return seat?.room.code ?? null;
}

/** Duels classés déjà joués entre ces deux joueurs depuis vingt-quatre heures. */
function pairDuels(a: string, b: string): Promise<number> {
  return db().rankedMatch.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 86_400_000) },
      OR: [
        { playerAId: a, playerBId: b },
        { playerAId: b, playerBId: a },
      ],
    },
  });
}

/**
 * Ouvre le salon d'un duel entre deux joueurs de la file. Chacun des deux doit
 * encore y attendre : si l'un vient d'être pris par un autre duel, rien n'est
 * créé et la fonction renvoie `null`.
 */
async function openDuel(me: QueueRow, other: QueueRow): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode(randomInt);
    try {
      return await db().$transaction(async (tx) => {
        // Tout le monde réserve les deux places dans le même ordre : deux recherches simultanées ne se bloquent pas l'une l'autre
        for (const entry of [me, other].sort((a, b) => a.userId.localeCompare(b.userId))) {
          const claimed = await tx.rankedQueue.updateMany({
            where: { userId: entry.userId, roomCode: null, ...(entry === other ? { lastSeenAt: { gte: presentSince() } } : {}) },
            data: { roomCode: code },
          });
          if (claimed.count === 0) throw new Taken();
        }
        const users = await tx.user.findMany({ where: { id: { in: [me.userId, other.userId] } }, select: { id: true, username: true } });
        const now = Date.now();
        await tx.room.create({
          data: {
            code,
            kind: "ranked",
            ...RANKED_SETTINGS,
            lang: me.lang,
            games: [...MIX_SLUGS],
            seed: randomInt(0, 0x7fffffff),
            status: "playing",
            phase: "countdown",
            phaseStartedAt: new Date(now),
            phaseEndsAt: new Date(now + COUNTDOWN_SECONDS * 1000),
            players: {
              // Personne n'a le jeton de ces places : chaque joueur reçoit le sien en entrant dans le salon avec son compte
              create: users.map((user) => ({
                name: user.username,
                nameKey: nameKey(user.username),
                userId: user.id,
                tokenHash: randomBytes(32).toString("hex"),
              })),
            },
          },
        });
        return code;
      });
    } catch (error) {
      if (error instanceof Taken) return null;
      // Code de salon déjà pris : on en tire un autre
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return null;
}

/** Cherche un adversaire au joueur en file : le plus proche de sa cote, parmi ceux que l'attente rend acceptables. */
async function search(userId: string): Promise<QueueStatus> {
  const me = await db().rankedQueue.findUnique({ where: { userId } });
  if (!me) return { status: "idle" };
  if (me.roomCode) return matched(userId, me.roomCode);

  const now = Date.now();
  const waiting = await db().rankedQueue.findMany({
    where: { lang: me.lang, roomCode: null, userId: { not: userId }, lastSeenAt: { gte: presentSince() } },
    orderBy: { joinedAt: "asc" },
    take: 30,
  });
  const candidates = waiting
    .filter((other) => canPair(me.rating, now - me.joinedAt.getTime(), other.rating, now - other.joinedAt.getTime()))
    .sort((a, b) => Math.abs(a.rating - me.rating) - Math.abs(b.rating - me.rating));

  for (const other of candidates) {
    if ((await pairDuels(userId, other.userId)) >= MAX_PAIR_DUELS_PER_DAY) continue;
    const code = await openDuel(me, other);
    if (code) return matched(userId, code);
    // L'adversaire visé a été pris ailleurs, ou c'est le joueur lui-même qu'un autre vient de choisir
    const mine = await db().rankedQueue.findUnique({ where: { userId }, select: { roomCode: true } });
    if (mine?.roomCode) return matched(userId, mine.roomCode);
  }
  return { status: "searching", since: me.joinedAt.getTime(), serverNow: now };
}

/** Le joueur a son duel : il quitte la file. S'il perd la réponse, `joinQueue` le ramènera à ce duel. */
async function matched(userId: string, code: string): Promise<QueueStatus> {
  await db().rankedQueue.deleteMany({ where: { userId } });
  return { status: "matched", code };
}

/** Entre dans la file d'attente. `lang` : langue des questions, donc de l'adversaire. */
export async function joinQueue(user: SessionUser, lang: Locale): Promise<QueueStatus> {
  const running = await runningDuel(user.id);
  if (running) return { status: "matched", code: running };

  const { profile } = await db().$transaction((tx) => ensureSeason(tx, user.id, seasonKey(dailyKey())));
  // Ménage : entrées abandonnées dans la file, et salons de la veille
  await db().rankedQueue.deleteMany({ where: { lastSeenAt: { lt: new Date(Date.now() - 3_600_000) } } });
  await db().room.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } });

  const now = new Date();
  await db().rankedQueue.upsert({
    where: { userId: user.id },
    create: { userId: user.id, lang, rating: profile.rating },
    update: { lang, rating: profile.rating, joinedAt: now, lastSeenAt: now, roomCode: null },
  });
  return search(user.id);
}

/** Signe de vie d'un joueur en file, et nouvelle recherche d'adversaire. */
export async function pollQueue(userId: string): Promise<QueueStatus> {
  const updated = await db().rankedQueue.updateMany({ where: { userId }, data: { lastSeenAt: new Date() } });
  return updated.count === 0 ? { status: "idle" } : search(userId);
}

/** Quitte la file. Sans effet si un adversaire vient d'être trouvé : le duel a lieu. */
export async function leaveQueue(userId: string): Promise<void> {
  await db().rankedQueue.deleteMany({ where: { userId, roomCode: null } });
}

// ---------------------------------------------------------------------------
// Duel

type DuelRoom = {
  id: string;
  settledAt: Date | null;
  players: { id: string; userId: string | null; name: string; score: number; joinedAt: Date }[];
};

const seats = (room: DuelRoom) => [...room.players].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime() || a.id.localeCompare(b.id));

/**
 * Met à jour les cotes des deux joueurs d'un duel terminé, une seule fois.
 * Renvoie `true` si c'est cet appel qui l'a fait.
 */
export async function settleDuel(room: DuelRoom): Promise<boolean> {
  if (room.settledAt) return false;
  const [a, b] = seats(room);
  const season = seasonKey(dailyKey());

  return db().$transaction(async (tx) => {
    const claimed = await tx.room.updateMany({
      where: { id: room.id, settledAt: null },
      data: { settledAt: new Date(), version: { increment: 1 } },
    });
    if (claimed.count === 0 || !a?.userId || !b?.userId) return false;

    const ratingA = (await ensureSeason(tx, a.userId, season)).profile.rating;
    const ratingB = (await ensureSeason(tx, b.userId, season)).profile.rating;
    const outcome = duelOutcome(a.score, b.score);
    const deltaA = ratingDelta(ratingA, ratingB, outcome);
    const deltaB = ratingDelta(ratingB, ratingA, (1 - outcome) as 0 | 0.5 | 1);

    const played = (rating: number, delta: number, won: boolean) => ({
      rating: applyDelta(rating, delta),
      rankedGames: { increment: 1 },
      rankedWins: { increment: won ? 1 : 0 },
    });
    await tx.user.update({ where: { id: a.userId }, data: played(ratingA, deltaA, outcome === 1) });
    await tx.user.update({ where: { id: b.userId }, data: played(ratingB, deltaB, outcome === 0) });
    await tx.rankedMatch.create({
      data: {
        roomId: room.id,
        season,
        playerAId: a.userId,
        playerBId: b.userId,
        nameA: a.name,
        nameB: b.name,
        scoreA: a.score,
        scoreB: b.score,
        ratingA,
        ratingB,
        // La cote a un plancher : on note ce qui a réellement changé
        deltaA: applyDelta(ratingA, deltaA) - ratingA,
        deltaB: applyDelta(ratingB, deltaB) - ratingB,
      },
    });
    return true;
  });
}

/** Ce qu'un joueur voit du classé dans le salon de son duel : les cotes au départ, puis ce que le duel y change. */
export async function duelView(room: DuelRoom, playerId: string): Promise<RoomRankedView> {
  const [a, b] = seats(room);
  const match = room.settledAt ? await db().rankedMatch.findUnique({ where: { roomId: room.id } }) : null;
  if (match && a && b) {
    const first = a.id === playerId;
    const [score, theirs] = first ? [match.scoreA, match.scoreB] : [match.scoreB, match.scoreA];
    const [before, delta] = first ? [match.ratingA, match.deltaA] : [match.ratingB, match.deltaB];
    return {
      ratings: { [a.id]: match.ratingA, [b.id]: match.ratingB },
      result: { outcome: score > theirs ? "win" : score < theirs ? "loss" : "draw", delta, rating: before + delta },
    };
  }
  const users = await db().user.findMany({
    where: { id: { in: room.players.map((p) => p.userId).filter((id): id is string => id !== null) } },
    select: { id: true, rating: true },
  });
  const ratingOf = new Map(users.map((user) => [user.id, user.rating]));
  return {
    ratings: Object.fromEntries(room.players.flatMap((p) => (p.userId && ratingOf.has(p.userId) ? [[p.id, ratingOf.get(p.userId)!]] : []))),
    result: null,
  };
}
