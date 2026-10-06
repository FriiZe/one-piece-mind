import type { PlayCharacter } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, pick, shuffle, type Rng } from "../engine/rng";

export const CRITERIA = {
  bounty: { label: { fr: "prime", en: "bounty" }, order: { fr: "de la plus haute à la plus basse", en: "from highest to lowest" } },
  height: { label: { fr: "taille", en: "height" }, order: { fr: "du plus grand au plus petit", en: "from tallest to shortest" } },
  age: { label: { fr: "âge", en: "age" }, order: { fr: "du plus âgé au plus jeune", en: "from oldest to youngest" } },
} as const;
export type Criterion = keyof typeof CRITERIA;

export const ROUND_SIZE = 5;
export const ROUNDS = 5;
export const MAX_SCORE = ROUNDS * ROUND_SIZE;
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

/** La manche n° `index` d'une partie : chaque manche a son propre tirage, dérivé de la graine. */
export function roundAt(seed: number, index: number, characters: readonly PlayCharacter[]): Round {
  return generateRound(createRng(seed + index), characters);
}

/** Rejoue une partie à partir de sa graine et des classements proposés. */
export function evaluate(
  seed: number,
  difficulty: Difficulty,
  orders: readonly (readonly string[])[],
  characters: readonly PlayCharacter[],
  limit = ROUNDS,
) {
  const rounds = Math.min(limit, ROUNDS);
  const pool = byDifficulty(characters, difficulty);
  let score = 0;
  for (let index = 0; index < rounds; index++) {
    const round = roundAt(seed, index, pool);
    const order = orders[index] ?? [];
    // Un classement n'est noté que s'il contient exactement les cinq personnages de la manche
    const ids = new Set(round.items.map((c) => c.id));
    if (order.length === ids.size && order.every((id) => ids.has(id)) && new Set(order).size === ids.size) {
      score += scoreRound(round, order);
    }
  }
  return { score, max: rounds * ROUND_SIZE };
}
