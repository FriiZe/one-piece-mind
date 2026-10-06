/** Anagramme : remettre dans l'ordre les lettres mélangées d'un nom. */
import type { PlayCharacter } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, sample, shuffle, type Rng } from "../engine/rng";
import { normalizeText } from "../engine/text";

export const ROUNDS = 8;

export type AnagramRound = { target: PlayCharacter; letters: string };

/** Noms d'un seul mot, assez longs pour que le mélange ait un intérêt. */
export function wordPool(characters: readonly PlayCharacter[]): PlayCharacter[] {
  return characters.filter((c) => /^[a-zà-ÿ]{5,10}$/i.test(c.name));
}

function scramble(rng: Rng, name: string): string {
  const upper = name.toUpperCase();
  for (let attempt = 0; attempt < 20; attempt++) {
    const mixed = shuffle(rng, [...upper]).join("");
    if (mixed !== upper) return mixed;
  }
  return [...upper].reverse().join("");
}

export function generateRounds(seed: number, difficulty: Difficulty, characters: readonly PlayCharacter[]): AnagramRound[] {
  const rng = createRng(seed);
  return sample(rng, wordPool(byDifficulty(characters, difficulty)), ROUNDS).map((target) => ({
    target,
    letters: scramble(rng, target.name),
  }));
}

export function isCorrect(round: AnagramRound, answer: string): boolean {
  return normalizeText(answer) === normalizeText(round.target.name);
}

/** Rejoue une partie : un point par nom retrouvé. */
export function evaluate(seed: number, difficulty: Difficulty, answers: readonly string[], characters: readonly PlayCharacter[], limit?: number) {
  const rounds = generateRounds(seed, difficulty, characters).slice(0, limit);
  const score = rounds.filter((round, index) => isCorrect(round, answers[index] ?? "")).length;
  return { score, max: rounds.length };
}
