import "server-only";
import type { Difficulty } from "@/games/engine/difficulty";
import { sanitizeCosmetics } from "@/lib/economy";
import type { GameLeaderboard, GameLeaderRow, GlobalLeaderboard, GlobalLeaderRow, Period } from "@/lib/leaderboard/types";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";

/** Lignes affichées d'un classement ; le joueur connecté s'y ajoute s'il est plus loin. */
export const GAME_LEADERS_SHOWN = 10;
export const GLOBAL_LEADERS_SHOWN = 50;

/** Les périodes sont celles de Paris, comme les jeux du jour : la semaine commence le lundi. */
const TRUNC: Record<Period, Prisma.Sql> = {
  day: Prisma.raw("'day'"),
  week: Prisma.raw("'week'"),
  month: Prisma.raw("'month'"),
};

type GameRow = {
  userId: string;
  username: string;
  score: number;
  maxScore: number;
  difficulty: string | null;
  createdAt: Date;
  cosmetics: unknown;
  equipped: unknown;
  rank: number;
  players: number;
};

/**
 * Classement d'un jeu sur la période : la meilleure partie de chaque joueur, par part des points,
 * puis par difficulté, puis la plus ancienne devant. Les parties sont celles que le serveur a
 * validées : seuls les comptes y figurent.
 */
export async function gameLeaderboard(
  slug: string,
  period: Period,
  userId: string | null,
  difficulty: Difficulty | null = null,
): Promise<GameLeaderboard> {
  const rows = await db().$queryRaw<GameRow[]>(Prisma.sql`
    WITH best AS (
      SELECT DISTINCT ON ("userId") "userId", score, "maxScore", difficulty, "createdAt",
        score::float / "maxScore" AS performance,
        CASE difficulty WHEN 'expert' THEN 3 WHEN 'facile' THEN 1 ELSE 2 END AS level
      FROM "GameResult"
      WHERE slug = ${slug} AND "maxScore" > 0
        AND (${difficulty}::text IS NULL OR difficulty = ${difficulty})
        AND date_trunc(${TRUNC[period]}, ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris')
          = date_trunc(${TRUNC[period]}, now() AT TIME ZONE 'Europe/Paris')
      ORDER BY "userId", performance DESC, level DESC, "createdAt" ASC
    ),
    ranked AS (
      SELECT b.*, u.username, u.cosmetics, u.equipped,
        RANK() OVER (ORDER BY b.performance DESC, b.level DESC, b."createdAt" ASC)::int AS rank,
        COUNT(*) OVER ()::int AS players
      FROM best b JOIN "User" u ON u.id = b."userId"
    )
    SELECT "userId", username, score, "maxScore", difficulty, "createdAt", cosmetics, equipped, rank, players
    FROM ranked
    WHERE rank <= ${GAME_LEADERS_SHOWN} OR "userId" = ${userId ?? ""}
    ORDER BY rank
  `);
  const view = (row: GameRow): GameLeaderRow => ({
    rank: row.rank,
    username: row.username,
    score: row.score,
    maxScore: row.maxScore,
    difficulty: row.difficulty === "facile" || row.difficulty === "normal" || row.difficulty === "expert" ? (row.difficulty as Difficulty) : null,
    playedAt: row.createdAt.getTime(),
    you: row.userId === userId,
    look: sanitizeCosmetics(row.cosmetics, row.equipped).equipped,
  });
  const shown = rows.filter((row) => row.rank <= GAME_LEADERS_SHOWN).map(view);
  const mine = rows.find((row) => row.userId === userId && row.rank > GAME_LEADERS_SHOWN);
  return { period, difficulty, rows: shown, you: mine ? view(mine) : null, players: rows[0]?.players ?? 0 };
}

type GlobalRow = { id: string; username: string; lifetimeBerrys: number; games: number; cosmetics: unknown; equipped: unknown; rank: number; players: number };

/** Classement général : les comptes par prime, c'est-à-dire par total de Berrys gagnés. */
export async function globalLeaderboard(userId: string | null): Promise<GlobalLeaderboard> {
  const rows = await db().$queryRaw<GlobalRow[]>(Prisma.sql`
    WITH ranked AS (
      SELECT id, username, "lifetimeBerrys", games, cosmetics, equipped,
        RANK() OVER (ORDER BY "lifetimeBerrys" DESC, "createdAt" ASC)::int AS rank,
        COUNT(*) OVER ()::int AS players
      FROM "User"
    )
    SELECT * FROM ranked WHERE rank <= ${GLOBAL_LEADERS_SHOWN} OR id = ${userId ?? ""} ORDER BY rank
  `);
  const view = (row: GlobalRow): GlobalLeaderRow => ({
    rank: row.rank,
    username: row.username,
    lifetimeBerrys: row.lifetimeBerrys,
    games: row.games,
    you: row.id === userId,
    look: sanitizeCosmetics(row.cosmetics, row.equipped).equipped,
  });
  const shown = rows.filter((row) => row.rank <= GLOBAL_LEADERS_SHOWN).map(view);
  const mine = rows.find((row) => row.id === userId && row.rank > GLOBAL_LEADERS_SHOWN);
  return { rows: shown, you: mine ? view(mine) : null, players: rows[0]?.players ?? 0 };
}
