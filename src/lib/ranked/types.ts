/** Classé : ce qu'en sait l'interface. */
import type { PlayerLook } from "@/lib/economy";
import type { Localized } from "@/lib/i18n";
import type { RankedProfile } from "./rules";

export type RankedLeaderRow = {
  rank: number;
  username: string;
  rating: number;
  games: number;
  wins: number;
  you: boolean;
  /** Cosmétiques que porte le joueur. */
  look: PlayerLook;
};

export type RankedMatchView = {
  id: string;
  opponent: string;
  outcome: "win" | "loss" | "draw";
  yourScore: number;
  theirScore: number;
  /** Variation de ta cote. */
  delta: number;
  createdAt: number;
};

/** Bilan de la saison précédente, affiché une fois au retour du joueur. */
export type SeasonRecap = { season: string; rating: number; games: number; wins: number; berrys: number; cosmetic: string | null };

export type RankedOverview = {
  season: string;
  daysLeft: number;
  profile: RankedProfile;
  /** Place du joueur dans la saison, s'il y a joué. */
  yourRank: number | null;
  leaderboard: RankedLeaderRow[];
  history: RankedMatchView[];
  /** Saison soldée à l'instant : sa prime vient d'être versée. */
  recap: SeasonRecap | null;
};

export type QueueStatus =
  | { status: "idle" }
  /** `since` : entrée dans la file (heure du serveur). */
  | { status: "searching"; since: number; serverNow: number }
  /** Adversaire trouvé : le duel se joue dans ce salon. */
  | { status: "matched"; code: string };

export type RankedError = "unavailable" | "bad-request";
export type QueueResult = ({ ok: true } & QueueStatus) | { ok: false; error: RankedError };

/** Duel classé, vu depuis son salon. */
export type RoomRankedView = {
  /** Cote de chaque joueur au début du duel, par identifiant de joueur du salon. */
  ratings: Record<string, number>;
  /** Une fois le duel terminé : ce qu'il change à la cote du joueur. */
  result: { outcome: "win" | "loss" | "draw"; delta: number; rating: number } | null;
};

export const RANKED_ERRORS: Localized<Record<RankedError, string>> = {
  fr: {
    unavailable: "Le classé est indisponible pour l'instant.",
    "bad-request": "Demande invalide.",
  },
  en: {
    unavailable: "Ranked play is unavailable right now.",
    "bad-request": "Invalid request.",
  },
};
