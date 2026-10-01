"use server";

/** Actions du raid. Chacune vérifie la session : elles peuvent être appelées directement. */
import { isLocale, type Locale } from "@/lib/i18n";
import { RAID_QUESTIONS } from "@/lib/raid/rules";
import type { RaidAttackResult, RaidClaimResult, RaidStartResult } from "@/lib/raid/types";
import { claimRaidLoot, finishRaidAttack, startRaidAttack } from "@/lib/server/raid";
import { currentUser } from "@/lib/server/session";
import type { SpoilerMode } from "@/lib/spoilers";

const UNAVAILABLE = { ok: false, error: "unavailable" } as const;
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 80;

/** `mode` et `lang` : ce que le joueur a le droit de voir, et la langue de ses questions. */
export async function startRaidAttackAction(mode: SpoilerMode, lang: Locale): Promise<RaidStartResult> {
  const user = await currentUser();
  if (!user || (mode !== "anime" && mode !== "manga") || !isLocale(lang)) return UNAVAILABLE;
  return startRaidAttack(user.id, mode, lang);
}

/** `answers` : la réponse choisie à chaque question, dans l'ordre ; `null` pour une question laissée sans réponse. */
export async function finishRaidAttackAction(attackId: string, answers: (string | null)[]): Promise<RaidAttackResult> {
  const user = await currentUser();
  if (!user || !isId(attackId) || !Array.isArray(answers) || answers.length > RAID_QUESTIONS) return UNAVAILABLE;
  return finishRaidAttack(user.id, attackId, answers);
}

export async function claimRaidLootAction(week: string): Promise<RaidClaimResult> {
  const user = await currentUser();
  if (!user || !isId(week)) return UNAVAILABLE;
  return claimRaidLoot(user.id, week);
}
