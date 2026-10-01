/** Wordle : trouver un nom en six essais, chaque essai indiquant les lettres bien ou mal placées. */
import type { PlayCharacter } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, pick } from "../engine/rng";
import { normalizeText } from "../engine/text";

export const MAX_TRIES = 6;
export type LetterState = "exact" | "present" | "absent";

/** Forme sous laquelle un nom se joue : majuscules, sans accent. */
export const toWord = (name: string) => normalizeText(name).replace(/ /g, "").toUpperCase();

/** Noms d'un seul mot de 4 à 8 lettres. */
export function wordPool(characters: readonly PlayCharacter[]): PlayCharacter[] {
  return characters.filter((c) => /^[a-zà-ÿ]{4,8}$/i.test(c.name));
}

export function targetOf(seed: number, difficulty: Difficulty, characters: readonly PlayCharacter[]): PlayCharacter {
  return pick(createRng(seed), wordPool(byDifficulty(characters, difficulty)));
}

/** État de chaque lettre d'un essai. Une lettre présente n'est signalée qu'autant de fois qu'elle figure dans le mot. */
export function feedback(guess: string, target: string): LetterState[] {
  const states: LetterState[] = [...guess].map((letter, i) => (letter === target[i] ? "exact" : "absent"));
  const remaining = new Map<string, number>();
  [...target].forEach((letter, i) => {
    if (states[i] !== "exact") remaining.set(letter, (remaining.get(letter) ?? 0) + 1);
  });
  [...guess].forEach((letter, i) => {
    if (states[i] === "exact" || !remaining.get(letter)) return;
    states[i] = "present";
    remaining.set(letter, remaining.get(letter)! - 1);
  });
  return states;
}

/** Un essai doit avoir la longueur du mot et ne contenir que des lettres. */
export function isValidGuess(guess: string, target: string): boolean {
  return guess.length === target.length && /^[A-Z]+$/.test(guess);
}

/** Rejoue une partie : 6 points au premier essai, un de moins à chaque essai, 0 si le mot n'est pas trouvé. */
export function evaluate(seed: number, difficulty: Difficulty, guesses: readonly string[], characters: readonly PlayCharacter[]) {
  const target = toWord(targetOf(seed, difficulty, characters).name);
  const valid = guesses.map(toWord).filter((guess) => isValidGuess(guess, target)).slice(0, MAX_TRIES);
  const attempts = valid.indexOf(target) + 1;
  return { score: attempts === 0 ? 0 : MAX_TRIES + 1 - attempts, max: MAX_TRIES };
}
