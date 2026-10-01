import type { PlayCharacter } from "../cards";
import { pick, type Rng } from "../engine/rng";

export type Answer = "higher" | "lower";
export type Bountied = PlayCharacter & { bounty: number };

export function bountyPool(characters: readonly PlayCharacter[]): Bountied[] {
  return characters.filter((c): c is Bountied => c.bounty !== null);
}

/** Adversaire suivant : une prime différente, et pas un personnage déjà vu récemment. */
export function nextOpponent(rng: Rng, pool: readonly Bountied[], current: Bountied, recentIds: readonly string[]): Bountied {
  const different = pool.filter((c) => c.id !== current.id && c.bounty !== current.bounty);
  const fresh = different.filter((c) => !recentIds.includes(c.id));
  return pick(rng, fresh.length ? fresh : different);
}

export function isCorrect(current: Bountied, next: Bountied, answer: Answer): boolean {
  return answer === (next.bounty > current.bounty ? "higher" : "lower");
}
