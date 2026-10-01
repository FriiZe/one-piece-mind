"use server";

/** Actions sur la file d'attente du classé. Chacune vérifie la session : elles peuvent être appelées directement. */
import { isLocale, type Locale } from "@/lib/i18n";
import type { QueueResult } from "@/lib/ranked/types";
import { joinQueue, leaveQueue } from "@/lib/server/ranked";
import { finishStaleDuels } from "@/lib/server/rooms";
import { allowAttempt, currentUser } from "@/lib/server/session";

/** `lang` : langue dans laquelle le joueur veut ses questions, donc son adversaire. */
export async function joinRankedQueueAction(lang: Locale): Promise<QueueResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "unavailable" };
  if (!isLocale(lang)) return { ok: false, error: "bad-request" };
  if (!(await allowAttempt(`ranked:${user.id}`, 120, 3_600_000))) return { ok: false, error: "unavailable" };
  // Un duel quitté avant la fin est soldé avant d'en chercher un autre
  await finishStaleDuels(user.id);
  return { ok: true, ...(await joinQueue(user, lang)) };
}

export async function leaveRankedQueueAction(): Promise<void> {
  const user = await currentUser();
  if (user) await leaveQueue(user.id);
}
