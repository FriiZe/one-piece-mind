/** Classements : ce qu'en sait l'interface. */
import type { Difficulty } from "@/games/engine/difficulty";
import type { PlayerLook } from "@/lib/economy";

export const PERIODS = ["day", "week", "month"] as const;
export type Period = (typeof PERIODS)[number];
export const isPeriod = (value: unknown): value is Period => (PERIODS as readonly unknown[]).includes(value);

/** Meilleure partie d'un joueur sur un jeu pendant la période. */
export type GameLeaderRow = {
  rank: number;
  username: string;
  score: number;
  maxScore: number;
  difficulty: Difficulty | null;
  playedAt: number;
  you: boolean;
  look: PlayerLook;
};

export type GameLeaderboard = {
  period: Period;
  /** Niveau retenu, `null` pour tous les niveaux. */
  difficulty: Difficulty | null;
  rows: GameLeaderRow[];
  /** Le joueur connecté, quand il a joué pendant la période sans figurer parmi les premiers ; `null` sinon. */
  you: GameLeaderRow | null;
  /** Nombre de joueurs classés sur la période. */
  players: number;
};

/** Un joueur qui a trouvé le personnage du défi du jour. */
export type DailyLeaderRow = {
  rank: number;
  username: string;
  attempts: number;
  playedAt: number;
  you: boolean;
  look: PlayerLook;
};

/** Défi du jour d'OnePiecedle : qui l'a trouvé, et en combien d'essais. */
export type DailyLeaderboard = {
  day: string;
  rows: DailyLeaderRow[];
  you: DailyLeaderRow | null;
  /** Nombre de joueurs qui l'ont trouvé. */
  players: number;
};

/** Un joueur du classement général, par prime. */
export type GlobalLeaderRow = {
  rank: number;
  username: string;
  lifetimeBerrys: number;
  games: number;
  you: boolean;
  look: PlayerLook;
};

export type GlobalLeaderboard = {
  rows: GlobalLeaderRow[];
  you: GlobalLeaderRow | null;
  players: number;
};
