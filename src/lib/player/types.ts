import type { PlayCharacter } from "@/games/cards";
import type { CosmeticError, CrewError, GameOutcome, PlayerState, Recruit, Reward } from "@/lib/economy";

/** Réponse à un compte rendu de partie, que le joueur soit invité ou connecté. */
export type GameResult =
  | { ok: true; state: PlayerState; outcome: GameOutcome; reward: Reward }
  /** `duplicate` : cette partie a déjà été récompensée. `invalid` : compte rendu refusé. */
  | { ok: false; reason: "duplicate" | "invalid" | "limit" | "unavailable" };

export type RecruitResult =
  | { ok: true; state: PlayerState; recruit: Recruit; cost: number }
  | { ok: false; reason: "insufficient" | "empty" | "unavailable" | "account" };

export type CrewResult = { ok: true; state: PlayerState } | { ok: false; reason: CrewError | "unavailable" };

export type BoosterResult =
  | { ok: true; state: PlayerState; recruits: Recruit[]; cost: number }
  | { ok: false; reason: "insufficient" | "empty" | "unavailable" | "account" };

/** Doublons défaits : `berrys` rendus pour `sold` avis. */
export type SellResult = { ok: true; state: PlayerState; berrys: number; sold: number } | { ok: false; reason: "nothing" | "unavailable" };

/** Achat ou port d'un cosmétique. */
/** `account` : les achats demandent un compte. */
export type CosmeticResult = { ok: true; state: PlayerState } | { ok: false; reason: CosmeticError | "unavailable" | "account" };

/** Ce que renvoie /api/me. */
export type MeResponse = {
  /** Faux tant qu'aucune base de données n'est configurée : le site fonctionne alors en mode invité. */
  accountsEnabled: boolean;
  /** `admin` : le joueur a accès à l'administration du site (`/admin`). */
  user: { username: string; admin: boolean } | null;
  state: PlayerState | null;
};

export type RecruitView = Recruit & { character: PlayCharacter | null };
