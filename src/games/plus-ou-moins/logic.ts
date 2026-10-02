import type { PlayCharacter } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { withinGap, type GapBand } from "../engine/gap";
import { createRng, pick, type Rng } from "../engine/rng";

export type Answer = "higher" | "lower";
export type Bountied = PlayCharacter & { bounty: number };

export function bountyPool(characters: readonly PlayCharacter[]): Bountied[] {
  return characters.filter((c): c is Bountied => c.bounty !== null);
}

/** Quand tous les personnages sont déjà passés, ceux des dernières manches restent écartés. */
const RECENT = 12;

/**
 * Écart entre les deux primes d'une manche, en nombre de fois : en facile, l'une vaut au moins le
 * double de l'autre ; en expert, elles se tiennent à moins d'un tiers près.
 */
export const BOUNTY_GAPS: Record<Difficulty, GapBand> = {
  facile: { min: 2, max: Infinity },
  normal: { min: 1.3, max: 3 },
  expert: { min: 1, max: 1.3 },
};

/** Combien de fois la plus haute des deux primes vaut la plus basse. */
export const bountyRatio = (a: Bountied, b: Bountied) => Math.max(a.bounty, b.bounty) / Math.max(1, Math.min(a.bounty, b.bounty));

/**
 * Adversaire suivant : une prime différente, à l'écart que veut la difficulté, et un personnage pas
 * encore vu dans la partie (`seenIds`, du plus ancien au plus récent). Une série assez longue pour
 * les épuiser reprend les plus anciens.
 */
export function nextOpponent(
  rng: Rng,
  pool: readonly Bountied[],
  current: Bountied,
  seenIds: readonly string[],
  difficulty: Difficulty,
): Bountied {
  const different = pool.filter((c) => c.id !== current.id && c.bounty !== current.bounty);
  const unseen = different.filter((c) => !seenIds.includes(c.id));
  const recent = seenIds.slice(-RECENT);
  const rested = different.filter((c) => !recent.includes(c.id));
  const candidates = unseen.length ? unseen : rested.length ? rested : different;
  return pick(rng, withinGap(candidates, (c) => bountyRatio(c, current), BOUNTY_GAPS[difficulty]));
}

export function isCorrect(current: Bountied, next: Bountied, answer: Answer): boolean {
  return answer === (next.bounty > current.bounty ? "higher" : "lower");
}

export type Chain = { current: Bountied; next: Bountied; seen: string[] };

/** Première paire d'une partie. */
export function startChain(seed: number, pool: readonly Bountied[], difficulty: Difficulty): Chain {
  const rng = createRng(seed);
  const current = pick(rng, pool);
  const next = nextOpponent(rng, pool, current, [current.id], difficulty);
  return { current, next, seen: [current.id, next.id] };
}

/** Paire suivante, après `streak` bonnes réponses : un tirage par manche, dérivé de la graine. */
export function advanceChain(seed: number, streak: number, pool: readonly Bountied[], chain: Chain, difficulty: Difficulty): Chain {
  const next = nextOpponent(createRng(seed + streak), pool, chain.next, chain.seen, difficulty);
  return { current: chain.next, next, seen: [...chain.seen, next.id] };
}

/** Série au-delà de laquelle la réussite est considérée comme totale. */
export const FULL_STREAK = 12;

/** Rejoue une partie : la série s'arrête à la première erreur. */
export function evaluate(seed: number, difficulty: Difficulty, answers: readonly Answer[], characters: readonly PlayCharacter[]) {
  const pool = bountyPool(byDifficulty(characters, difficulty));
  let chain = startChain(seed, pool, difficulty);
  let streak = 0;
  for (const answer of answers) {
    if (!isCorrect(chain.current, chain.next, answer)) break;
    streak++;
    chain = advanceChain(seed, streak, pool, chain, difficulty);
  }
  return { score: streak, max: FULL_STREAK };
}
