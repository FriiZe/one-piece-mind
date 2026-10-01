import type { PlayCharacter } from "@/games/cards";
import type { GameOutcome, PlayerState, Recruit, Reward } from "@/lib/economy";

/** Réponse à un compte rendu de partie, que le joueur soit invité ou connecté. */
export type GameResult =
  | { ok: true; state: PlayerState; outcome: GameOutcome; reward: Reward }
  /** `duplicate` : cette partie a déjà été récompensée. `invalid` : compte rendu refusé. */
  | { ok: false; reason: "duplicate" | "invalid" | "limit" | "unavailable" };

export type RecruitResult =
  | { ok: true; state: PlayerState; recruit: Recruit; cost: number }
  | { ok: false; reason: "insufficient" | "empty" | "unavailable" };

export type CrewResult = { ok: true; state: PlayerState } | { ok: false; reason: "not-owned" | "unknown-post" | "unavailable" };

/** Ce que renvoie /api/me. */
export type MeResponse = {
  /** Faux tant qu'aucune base de données n'est configurée : le site fonctionne alors en mode invité. */
  accountsEnabled: boolean;
  user: { username: string } | null;
  state: PlayerState | null;
};

export type RecruitView = Recruit & { character: PlayCharacter | null };
