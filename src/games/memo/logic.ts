/** Mémo : huit paires à retrouver, chaque personnage avec son fruit du démon. */
import type { ResolvedData } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, sample, shuffle } from "../engine/rng";

export const PAIRS = 8;
/** Nombre de coups au-delà duquel la partie ne rapporte plus que le minimum. */
const WORST_MOVES = 24;
export const MAX_SCORE = WORST_MOVES - PAIRS;

export type MemoCard = { pair: number; kind: "character" | "fruit"; label: string; img?: string | null };

export function generateDeck(seed: number, difficulty: Difficulty, data: ResolvedData): MemoCard[] {
  const rng = createRng(seed);
  const eaters = byDifficulty(data.characters, difficulty).filter((c) => c.fruitId && data.fruitById.has(c.fruitId));
  // Un fruit ne doit figurer qu'une fois : deux utilisateurs du même fruit rendraient les paires ambiguës
  const fruits = new Set<string>();
  const chosen = sample(rng, eaters, eaters.length).filter((c) => !fruits.has(c.fruitId!) && fruits.add(c.fruitId!)).slice(0, PAIRS);
  const cards = chosen.flatMap((c, pair): MemoCard[] => [
    { pair, kind: "character", label: c.name, img: c.img },
    { pair, kind: "fruit", label: data.fruitById.get(c.fruitId!)!.name },
  ]);
  return shuffle(rng, cards);
}

/** Points selon le nombre de coups : 16 pour une partie sans erreur (8 coups), 1 au-delà de 23. */
export function scoreFor(moves: number): number {
  return Math.max(1, WORST_MOVES - moves);
}

/**
 * Rejoue une partie : chaque coup retourne deux cartes. La partie ne compte
 * que si toutes les paires ont été trouvées.
 */
export function evaluate(seed: number, difficulty: Difficulty, flips: readonly (readonly [number, number])[], data: ResolvedData) {
  const deck = generateDeck(seed, difficulty, data);
  const matched = new Set<number>();
  let moves = 0;
  for (const [a, b] of flips) {
    if (matched.size === deck.length) break;
    if (a === b || !deck[a] || !deck[b] || matched.has(a) || matched.has(b)) continue;
    moves++;
    if (deck[a].pair === deck[b].pair) {
      matched.add(a);
      matched.add(b);
    }
  }
  return { score: matched.size === deck.length && deck.length > 0 ? scoreFor(moves) : 0, max: MAX_SCORE };
}
