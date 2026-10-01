import type { PlayCharacter } from "../cards";
import { pick, shuffle, type Rng } from "../engine/rng";

export const CRITERIA = {
  bounty: { label: "prime", order: "de la plus haute à la plus basse" },
  height: { label: "taille", order: "du plus grand au plus petit" },
  age: { label: "âge", order: "du plus âgé au plus jeune" },
} as const;
export type Criterion = keyof typeof CRITERIA;

export const ROUND_SIZE = 5;
export type Round = { criterion: Criterion; items: PlayCharacter[] };

/** Cinq personnages aux valeurs toutes différentes pour le critère tiré, dans un ordre mélangé. */
export function generateRound(rng: Rng, characters: readonly PlayCharacter[]): Round {
  const usable = (Object.keys(CRITERIA) as Criterion[]).filter(
    (criterion) => new Set(characters.map((c) => c[criterion]).filter((v) => v !== null)).size >= ROUND_SIZE,
  );
  const criterion = pick(rng, usable);

  const items: PlayCharacter[] = [];
  const values = new Set<number>();
  for (const candidate of shuffle(rng, characters)) {
    const value = candidate[criterion];
    if (value === null || values.has(value)) continue;
    values.add(value);
    items.push(candidate);
    if (items.length === ROUND_SIZE) break;
  }
  return { criterion, items };
}

/** Identifiants dans le bon ordre : de la plus grande valeur à la plus petite. */
export function correctOrder(round: Round): string[] {
  return [...round.items].sort((a, b) => b[round.criterion]! - a[round.criterion]!).map((c) => c.id);
}

/** Nombre de personnages placés au bon rang. */
export function scoreRound(round: Round, orderedIds: readonly string[]): number {
  const expected = correctOrder(round);
  return orderedIds.filter((id, index) => expected[index] === id).length;
}
