import { EXCHANGE_MIN_PLAY_DAYS } from "@/lib/economy";
import { db } from "@/lib/server/db";

const DAY = 86_400_000;

/** Enregistre une partie validée pour ce compte, `daysAgo` jours en arrière. */
export async function playedOn(userId: string, daysAgo: number): Promise<void> {
  await db().gameResult.create({
    data: {
      userId,
      slug: "type-de-fruit",
      reportKey: `test-${daysAgo}-${Math.random().toString(36).slice(2)}`,
      mode: "anime",
      score: 5,
      maxScore: 10,
      berrys: 0,
      // À midi : le jour reste le même à Paris, quelle que soit l'heure du test
      createdAt: new Date(Math.floor(Date.now() / DAY) * DAY - daysAgo * DAY + DAY / 2),
    },
  });
}

/** Fait d'un compte de test un compte à qui les échanges et le marché sont ouverts : il a joué assez de jours. */
export async function establish(userId: string): Promise<void> {
  for (let daysAgo = 1; daysAgo <= EXCHANGE_MIN_PLAY_DAYS; daysAgo++) await playedOn(userId, daysAgo);
}
