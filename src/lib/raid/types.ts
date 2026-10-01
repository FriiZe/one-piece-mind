/** Raid de la semaine : ce qu'en sait l'interface. */
import type { PlayerLook, PlayerState } from "@/lib/economy";
import type { QcmOption } from "@/games/qcm/logic";
import type { Localized } from "@/lib/i18n";
import type { BossKind } from "./rules";

export type RaidLeaderRow = { rank: number; username: string; damage: number; you: boolean; look: PlayerLook };

/** Butin d'un raid vaincu que le joueur n'a pas encore récupéré. */
export type RaidLootView = { week: string; bossId: string; rank: number; golden: boolean; berrys: number };

export type RaidView = {
  week: string;
  daysLeft: number;
  boss: { id: string; kind: BossKind };
  hp: number;
  damage: number;
  defeated: boolean;
  participants: number;
  leaderboard: RaidLeaderRow[];
  /** Le joueur connecté ; `null` pour un visiteur. */
  you: { damage: number; attacks: number; rank: number | null; attacksLeft: number } | null;
  loot: RaidLootView[];
};

/** Question d'un assaut, telle qu'elle part au navigateur : sans sa réponse. */
export type RaidQuestion = { title: string; subject: string; detail?: string; img?: string | null; options: QcmOption[] };

export type RaidError =
  | "unavailable"
  /** Plus d'assaut aujourd'hui. */
  | "limit"
  /** L'adversaire est déjà vaincu. */
  | "defeated"
  | "not-found"
  /** Assaut rendu après le délai : il ne compte pas. */
  | "expired"
  /** Pas assez de dégâts pour prétendre au butin. */
  | "not-eligible";

export type RaidStartResult = { ok: true; attackId: string; questions: RaidQuestion[] } | { ok: false; error: RaidError };

export type RaidAttackResult =
  | {
      ok: true;
      correct: number;
      damage: number;
      /** Part des dégâts due à l'équipage, de 0 à 1 et plus. */
      crewBonus: number;
      berrys: number;
      /** Correction de chaque question. */
      answers: { answerId: string; explanation: string }[];
      /** Cet assaut a porté le coup de grâce. */
      finisher: boolean;
      state: PlayerState;
    }
  | { ok: false; error: RaidError };

export type RaidClaimResult =
  | { ok: true; berrys: number; characterId: string; golden: boolean; cosmetic: string | null; state: PlayerState }
  | { ok: false; error: RaidError };

export const RAID_ERRORS: Localized<Record<RaidError, string>> = {
  fr: {
    unavailable: "Le raid est indisponible pour l'instant.",
    limit: "Tu as lancé tous tes assauts du jour. Reviens demain.",
    defeated: "L'adversaire est déjà vaincu.",
    "not-found": "Cet assaut n'existe plus.",
    expired: "Assaut rendu trop tard : il ne compte pas.",
    "not-eligible": "Il faut avoir pris part au combat pour toucher le butin.",
  },
  en: {
    unavailable: "The raid is unavailable right now.",
    limit: "You've used all of today's assaults. Come back tomorrow.",
    defeated: "The boss has already been defeated.",
    "not-found": "That assault no longer exists.",
    expired: "Assault handed in too late: it doesn't count.",
    "not-eligible": "You need to have joined the fight to claim the loot.",
  },
};
