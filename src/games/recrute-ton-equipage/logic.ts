/**
 * Recrute ton équipage : dix personnages primés tirés un à un, dix postes du
 * capitaine au mousse. Le joueur place chacun sans connaître les suivants ;
 * l'équipage idéal range les primes de la plus haute à la plus basse.
 */
import type { PlayCharacter, ResolvedData } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, shuffle } from "../engine/rng";

/** Postes, du plus haut au plus bas : le premier attend la plus grosse prime. */
export const POSTS = [
  "Capitaine",
  "Second",
  "Sabreur",
  "Tireur d'élite",
  "Navigateur",
  "Cuisinier",
  "Médecin",
  "Charpentier",
  "Musicien",
  "Mousse",
] as const;
export const POINTS_PER_POST = 5;
export const MAX_SCORE = POSTS.length * POINTS_PER_POST;

/** Dix personnages aux primes toutes différentes, dans l'ordre où ils se présentent. */
export function generateDraw(seed: number, difficulty: Difficulty, data: ResolvedData): PlayCharacter[] {
  const seen = new Set<number>();
  const draw: PlayCharacter[] = [];
  for (const character of shuffle(createRng(seed), byDifficulty(data.characters, difficulty))) {
    if (character.bounty === null || character.bounty <= 0 || seen.has(character.bounty)) continue;
    seen.add(character.bounty);
    draw.push(character);
    if (draw.length === POSTS.length) break;
  }
  return draw.length === POSTS.length ? draw : [];
}

/** Rang de chaque personnage du tirage : 0 pour la plus grosse prime. */
export function ranksOf(draw: readonly PlayCharacter[]): number[] {
  const ordered = [...draw].sort((a, b) => b.bounty! - a.bounty!);
  return draw.map((character) => ordered.indexOf(character));
}

/** Points d'un placement : 5 au bon poste, un de moins par poste d'écart. */
export function pointsFor(rank: number, post: number): number {
  return Math.max(0, POINTS_PER_POST - Math.abs(rank - post));
}

/** `posts[i]` : poste donné au i-ème personnage du tirage. Chaque poste ne sert qu'une fois. */
export function scorePlacement(draw: readonly PlayCharacter[], posts: readonly number[]): number {
  const valid =
    posts.length === draw.length &&
    new Set(posts).size === posts.length &&
    posts.every((post) => Number.isInteger(post) && post >= 0 && post < draw.length);
  if (!valid) return 0;
  const ranks = ranksOf(draw);
  return posts.reduce((sum, post, index) => sum + pointsFor(ranks[index], post), 0);
}

/** Rejoue une partie à partir de sa graine et des postes attribués. */
export function evaluate(seed: number, difficulty: Difficulty, posts: readonly number[], data: ResolvedData) {
  return { score: scorePlacement(generateDraw(seed, difficulty, data), posts), max: MAX_SCORE };
}
