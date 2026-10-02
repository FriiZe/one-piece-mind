import type { Difficulty } from "@/games/engine/difficulty";
import type { GameStats } from "./types";

/**
 * Objectifs proposés pour chaque jeu : jouer régulièrement, et bien jouer.
 * Chacun rapporte une prime, versée une fois, quand il est atteint. Celle d'un
 * objectif de score dépend de la difficulté (voir `SKILL_FACTOR`).
 */
export const OBJECTIVES = [
  { id: "games-1", kind: "games", target: 1, berrys: 100, label: { fr: "Jouer une première partie", en: "Play your first game" } },
  { id: "games-10", kind: "games", target: 10, berrys: 500, label: { fr: "Jouer 10 parties", en: "Play 10 games" } },
  { id: "games-50", kind: "games", target: 50, berrys: 2000, label: { fr: "Jouer 50 parties", en: "Play 50 games" } },
  { id: "best-50", kind: "best", target: 0.5, berrys: 200, label: { fr: "Marquer la moitié des points", en: "Score half the points" } },
  { id: "best-80", kind: "best", target: 0.8, berrys: 500, label: { fr: "Marquer 80 % des points", en: "Score 80% of the points" } },
  { id: "best-100", kind: "best", target: 1, berrys: 1500, label: { fr: "Réussir un sans-faute", en: "Get a perfect score" } },
] as const;

export type Objective = (typeof OBJECTIVES)[number];

/**
 * Ce que vaut un objectif ou un défi de score selon la difficulté de la partie :
 * un sans-faute en facile rapporte la moitié, en expert le triple. Sans cela,
 * le plus simple serait de tout réussir en facile.
 */
export const SKILL_FACTOR: Record<Difficulty, number> = { facile: 0.5, normal: 1, expert: 3 };
export const SKILL_LEVELS = Object.keys(SKILL_FACTOR) as Difficulty[];
export const skillFactor = (difficulty: Difficulty | null) => (difficulty ? SKILL_FACTOR[difficulty] : 1);

const NO_STATS: GameStats = { games: 0, best: 0 };

/**
 * Part de la prime déjà acquise : 0 tant que l'objectif n'est pas atteint.
 * Pour un objectif de score, c'est le coefficient de la plus haute difficulté
 * à laquelle il l'a été ; 1 pour un jeu sans difficulté, ou pour un parcours
 * enregistré avant que la difficulté compte (la prime avait été versée entière).
 */
export function objectiveLevel(objective: Objective, stats: GameStats | undefined): number {
  const { games, best, bestBy } = stats ?? NO_STATS;
  if (objective.kind === "games") return games >= objective.target ? 1 : 0;
  if (!bestBy) return best >= objective.target ? 1 : 0;
  return Math.max(0, ...SKILL_LEVELS.filter((level) => (bestBy[level] ?? 0) >= objective.target).map((level) => SKILL_FACTOR[level]));
}

export function isMet(objective: Objective, stats: GameStats | undefined): boolean {
  return objectiveLevel(objective, stats) > 0;
}

/** Avancement d'un objectif, de 0 à 1, pour l'affichage. */
export function objectiveProgress(objective: Objective, stats: GameStats | undefined): number {
  const { games, best } = stats ?? NO_STATS;
  return Math.min(1, (objective.kind === "games" ? games : best) / objective.target);
}

/** Parcours du joueur après une partie. `difficulty` : `null` pour un jeu sans niveau. */
export function withGame(stats: GameStats | undefined, performance: number, difficulty: Difficulty | null = null): GameStats {
  const { games, best, bestBy } = stats ?? NO_STATS;
  const next: GameStats = { games: games + 1, best: Math.max(best, performance) };
  if (!difficulty) return bestBy ? { ...next, bestBy } : next;
  // Un record d'avant la prise en compte de la difficulté compte comme obtenu en normal : sa prime a été versée entière
  const known = bestBy ?? (best > 0 ? { normal: best } : {});
  return { ...next, bestBy: { ...known, [difficulty]: Math.max(known[difficulty] ?? 0, performance) } };
}

/**
 * Objectifs que cette partie fait payer, avec leur prime : ceux qu'elle vient
 * d'atteindre, et ceux, déjà atteints, qu'elle réussit à une difficulté plus
 * haute. Dans ce cas, seule la différence est versée.
 */
export function newlyMet(before: GameStats | undefined, after: GameStats): { objective: Objective; berrys: number }[] {
  return OBJECTIVES.flatMap((objective) => {
    const gain = objectiveLevel(objective, after) - objectiveLevel(objective, before);
    return gain > 0 ? [{ objective, berrys: Math.round(objective.berrys * gain) }] : [];
  });
}
