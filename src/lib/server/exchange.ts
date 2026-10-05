import "server-only";
import { exchangeAccess, type ExchangeAccess } from "@/lib/economy";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";

/**
 * Où en est un compte pour les échanges et le marché : le nombre de jours différents (à l'heure de
 * Paris, comme les jeux du jour) où le serveur a validé une de ses parties.
 */
export async function exchangeAccessFor(userId: string): Promise<ExchangeAccess> {
  const [row] = await db().$queryRaw<{ days: number }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris')::date)::int AS days
    FROM "GameResult"
    WHERE "userId" = ${userId}
  `);
  return exchangeAccess(row?.days ?? 0);
}
