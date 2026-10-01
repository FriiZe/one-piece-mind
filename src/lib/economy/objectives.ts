import type { GameStats } from "./types";

/**
 * Objectifs proposés pour chaque jeu : jouer régulièrement, et bien jouer.
 * Chacun rapporte une prime, versée une fois, quand il est atteint.
 */
export const OBJECTIVES = [
  { id: "games-1", kind: "games", target: 1, berrys: 100, label: "Jouer une première partie" },
  { id: "games-10", kind: "games", target: 10, berrys: 500, label: "Jouer 10 parties" },
  { id: "games-50", kind: "games", target: 50, berrys: 2000, label: "Jouer 50 parties" },
  { id: "best-50", kind: "best", target: 0.5, berrys: 200, label: "Marquer la moitié des points" },
  { id: "best-80", kind: "best", target: 0.8, berrys: 500, label: "Marquer 80 % des points" },
  { id: "best-100", kind: "best", target: 1, berrys: 1500, label: "Réussir un sans-faute" },
] as const;

export type Objective = (typeof OBJECTIVES)[number];

const NO_STATS: GameStats = { games: 0, best: 0 };

export function isMet(objective: Objective, stats: GameStats | undefined): boolean {
  const { games, best } = stats ?? NO_STATS;
  return objective.kind === "games" ? games >= objective.target : best >= objective.target;
}

/** Avancement d'un objectif, de 0 à 1, pour l'affichage. */
export function objectiveProgress(objective: Objective, stats: GameStats | undefined): number {
  const { games, best } = stats ?? NO_STATS;
  return Math.min(1, (objective.kind === "games" ? games : best) / objective.target);
}

/** Parcours du joueur après une partie. */
export function withGame(stats: GameStats | undefined, performance: number): GameStats {
  const { games, best } = stats ?? NO_STATS;
  return { games: games + 1, best: Math.max(best, performance) };
}

/** Objectifs que cette partie vient de faire atteindre. */
export function newlyMet(before: GameStats | undefined, after: GameStats): Objective[] {
  return OBJECTIVES.filter((objective) => !isMet(objective, before) && isMet(objective, after));
}
