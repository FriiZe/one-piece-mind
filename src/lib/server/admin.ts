import "server-only";
import { z } from "zod";
import { dailyKey } from "@/games/engine/daily";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { isAdmin } from "./quizzes";
import type { SessionUser } from "./session";

/**
 * Suivi du site pour les administrateurs : inscriptions, joueurs actifs,
 * parties. Chaque fonction vérifie elle-même que le demandeur est
 * administrateur et renvoie `null` sinon : aucune page n'a à s'en charger.
 *
 * Seuls les comptes sont suivis. Un invité joue sans rien envoyer au serveur.
 */

const DAY = 86_400_000;

/** Périodes proposées sur le tableau de bord, en jours. */
export const ADMIN_PERIODS = [7, 30, 90] as const;
export type AdminPeriod = (typeof ADMIN_PERIODS)[number];
export const DEFAULT_ADMIN_PERIOD: AdminPeriod = 30;

export type AdminDay = {
  /** Jour à Paris, AAAA-MM-JJ. */
  day: string;
  signups: number;
  /** Parties récompensées ce jour-là. */
  games: number;
  /** Comptes qui ont terminé au moins une partie ce jour-là. */
  players: number;
};

export type AdminUserRow = {
  id: string;
  username: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  games: number;
  berrys: number;
  lifetimeBerrys: number;
  /** Avis de recherche différents dans la collection. */
  cards: number;
};

export type AdminOverview = {
  accounts: number;
  seen24h: number;
  seen7d: number;
  hiddenQuizzes: number;
  period: AdminPeriod;
  /** Un élément par jour de la période, du plus ancien à aujourd'hui. */
  days: AdminDay[];
  /** Sur la période : comptes différents qui ont joué, quiz publiés, échanges proposés. */
  players: number;
  quizzes: number;
  trades: number;
  topGames: { slug: string; games: number; players: number }[];
  latest: AdminUserRow[];
};

/** Jour (à Paris) d'une colonne de date, enregistrée en UTC. */
const parisDay = (column: Prisma.Sql) => Prisma.sql`to_char(${column} AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD')`;
/** Minuit à Paris pour ce jour, exprimé comme les dates de la base (UTC). */
const parisMidnight = (day: string) => Prisma.sql`(${day}::date::timestamp AT TIME ZONE 'Europe/Paris' AT TIME ZONE 'UTC')`;
const CREATED_AT = Prisma.sql`"createdAt"`;

/** Les `count` derniers jours, du plus ancien à `today`. */
function lastDays(today: string, count: number): string[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => new Date(end - (count - 1 - i) * DAY).toISOString().slice(0, 10));
}

const userRowSelect = {
  id: true,
  username: true,
  createdAt: true,
  lastSeenAt: true,
  games: true,
  berrys: true,
  lifetimeBerrys: true,
  _count: { select: { collection: true } },
} satisfies Prisma.UserSelect;

const toRow = ({ _count, ...user }: Prisma.UserGetPayload<{ select: typeof userRowSelect }>): AdminUserRow => ({
  ...user,
  cards: _count.collection,
});

export async function adminOverview(user: SessionUser | null, period: AdminPeriod, today = dailyKey()): Promise<AdminOverview | null> {
  if (!isAdmin(user)) return null;
  const days = lastDays(today, period);
  const start = parisMidnight(days[0]);
  const now = Date.now();

  const [accounts, seen24h, seen7d, hiddenQuizzes, signups, games, [totals], topGames, latest] = await Promise.all([
    db().user.count(),
    db().user.count({ where: { lastSeenAt: { gte: new Date(now - DAY) } } }),
    db().user.count({ where: { lastSeenAt: { gte: new Date(now - 7 * DAY) } } }),
    db().quiz.count({ where: { status: "hidden" } }),
    db().$queryRaw<{ day: string; count: number }[]>`
      SELECT ${parisDay(CREATED_AT)} AS day, count(*)::int AS count
      FROM "User" WHERE "createdAt" >= ${start} GROUP BY 1`,
    db().$queryRaw<{ day: string; games: number; players: number }[]>`
      SELECT ${parisDay(CREATED_AT)} AS day, count(*)::int AS games, count(DISTINCT "userId")::int AS players
      FROM "GameResult" WHERE "createdAt" >= ${start} GROUP BY 1`,
    db().$queryRaw<{ players: number; quizzes: number; trades: number }[]>`
      SELECT
        (SELECT count(DISTINCT "userId")::int FROM "GameResult" WHERE "createdAt" >= ${start}) AS players,
        (SELECT count(*)::int FROM "Quiz" WHERE "createdAt" >= ${start}) AS quizzes,
        (SELECT count(*)::int FROM "Trade" WHERE "createdAt" >= ${start}) AS trades`,
    db().$queryRaw<{ slug: string; games: number; players: number }[]>`
      SELECT slug, count(*)::int AS games, count(DISTINCT "userId")::int AS players
      FROM "GameResult" WHERE "createdAt" >= ${start}
      GROUP BY slug ORDER BY games DESC, slug LIMIT 10`,
    db().user.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: userRowSelect }),
  ]);

  const signupsByDay = new Map(signups.map((row) => [row.day, row.count]));
  const gamesByDay = new Map(games.map((row) => [row.day, row]));
  return {
    accounts,
    seen24h,
    seen7d,
    hiddenQuizzes,
    period,
    days: days.map((day) => ({
      day,
      signups: signupsByDay.get(day) ?? 0,
      games: gamesByDay.get(day)?.games ?? 0,
      players: gamesByDay.get(day)?.players ?? 0,
    })),
    ...totals,
    topGames,
    latest: latest.map(toRow),
  };
}

// ---------------------------------------------------------------------------
// Liste des joueurs

export const ADMIN_USER_SORTS = ["recent", "seen", "games", "bounty", "berrys"] as const;
export type AdminUserSort = (typeof ADMIN_USER_SORTS)[number];

const ORDER: Record<AdminUserSort, Prisma.UserOrderByWithRelationInput[]> = {
  recent: [{ createdAt: "desc" }],
  // Un joueur jamais revu depuis que les visites sont notées passe après les autres
  seen: [{ lastSeenAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  games: [{ games: "desc" }, { createdAt: "desc" }],
  bounty: [{ lifetimeBerrys: "desc" }, { createdAt: "desc" }],
  berrys: [{ berrys: "desc" }, { createdAt: "desc" }],
};

export const ADMIN_PAGE_SIZE = 50;

export type AdminUserList = {
  /** Comptes qui correspondent à la recherche. */
  total: number;
  page: number;
  pages: number;
  rows: AdminUserRow[];
};

/** Les joueurs, par pages de `ADMIN_PAGE_SIZE`. `query` : un morceau de pseudo. */
export async function adminUsers(
  user: SessionUser | null,
  { query = "", sort = "recent", page = 1 }: { query?: string; sort?: AdminUserSort; page?: number },
): Promise<AdminUserList | null> {
  if (!isAdmin(user)) return null;
  const needle = query.trim().toLowerCase().slice(0, 40);
  const where: Prisma.UserWhereInput = needle ? { usernameKey: { contains: needle } } : {};

  const total = await db().user.count({ where });
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const rows = await db().user.findMany({
    where,
    orderBy: ORDER[sort],
    skip: (current - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: userRowSelect,
  });
  return { total, page: current, pages, rows: rows.map(toRow) };
}

// ---------------------------------------------------------------------------
// Fiche d'un joueur

const statsSchema = z.record(z.string(), z.object({ games: z.number(), best: z.number() }));

export type AdminUserDetail = AdminUserRow & {
  /** Berrys gagnés aujourd'hui (plafond journalier), si le joueur a joué aujourd'hui. */
  earnedToday: number;
  /** Exemplaires dans la collection, doublons compris, et avis dorés. */
  copies: number;
  golden: number;
  crew: number;
  friends: number;
  trades: number;
  /** Sessions encore valides, et date de la dernière connexion par mot de passe. */
  sessions: number;
  lastLogin: Date | null;
  /** Parcours par jeu, du plus joué au moins joué. `best` : meilleure part de bonnes réponses, de 0 à 1. */
  perGame: { slug: string; games: number; best: number }[];
  recentGames: {
    id: string;
    slug: string;
    mode: string;
    difficulty: string | null;
    score: number;
    maxScore: number;
    berrys: number;
    recruitId: string | null;
    createdAt: Date;
  }[];
  quizzes: { id: string; title: string; status: string; plays: number; createdAt: Date }[];
};

export async function adminUser(user: SessionUser | null, id: string, today = dailyKey()): Promise<AdminUserDetail | null> {
  if (!isAdmin(user)) return null;
  const row = await db().user.findUnique({
    where: { id },
    select: {
      ...userRowSelect,
      dayKey: true,
      dayEarned: true,
      stats: true,
      _count: { select: { collection: true, crew: true } },
      quizzes: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, status: true, plays: true, createdAt: true } },
    },
  });
  if (!row) return null;

  const involved = { OR: [{ fromId: id }, { toId: id }] };
  const [copies, friends, trades, sessions, lastLogin, recentGames] = await Promise.all([
    db().collectionEntry.aggregate({ where: { userId: id }, _sum: { count: true, golden: true } }),
    db().friendship.count({ where: { status: "accepted", OR: [{ requesterId: id }, { addresseeId: id }] } }),
    db().trade.count({ where: involved }),
    db().session.count({ where: { userId: id, expiresAt: { gt: new Date() } } }),
    db().session.findFirst({ where: { userId: id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db().gameResult.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, slug: true, mode: true, difficulty: true, score: true, maxScore: true, berrys: true, recruitId: true, createdAt: true },
    }),
  ]);

  const { dayKey, dayEarned, stats, quizzes, _count, ...account } = row;
  return {
    ...account,
    cards: _count.collection,
    earnedToday: dayKey === today ? dayEarned : 0,
    copies: copies._sum.count ?? 0,
    golden: copies._sum.golden ?? 0,
    crew: _count.crew,
    friends,
    trades,
    sessions,
    lastLogin: lastLogin?.createdAt ?? null,
    // Colonne JSON : on ne se fie à son contenu qu'après validation
    perGame: Object.entries(statsSchema.safeParse(stats).data ?? {})
      .map(([slug, entry]) => ({ slug, ...entry }))
      .sort((a, b) => b.games - a.games || a.slug.localeCompare(b.slug)),
    recentGames,
    quizzes,
  };
}
