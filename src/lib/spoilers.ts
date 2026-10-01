/**
 * Filtrage des spoilers. Le joueur choisit un mode au lancement d'un jeu :
 * « anime » ne voit que ce que l'anime a déjà adapté, « manga » voit tout.
 *
 * Limite connue : `status` (vivant / décédé) n'est pas daté dans les sources ;
 * une mort survenue après la limite de l'anime se corrige dans
 * data/overrides/characters.json.
 */
import { meta } from "./data";
import type { Character, Fruit } from "./data/schema";

export type SpoilerMode = "anime" | "manga";
export const SPOILER_MODES: SpoilerMode[] = ["anime", "manga"];

/** Dernier chapitre dont le contenu peut être montré dans ce mode. */
export function chapterLimit(mode: SpoilerMode, animeCutoff = meta.animeCutoffChapter): number {
  return mode === "anime" ? animeCutoff : Infinity;
}

/** Un fait daté (`since` = chapitre de révélation, `null` = connu de tous) est-il montrable ? */
export function isKnown(since: number | null, mode: SpoilerMode, animeCutoff?: number): boolean {
  return since === null || since <= chapterLimit(mode, animeCutoff);
}

/**
 * Un personnage peut-il être tiré dans un jeu ? Il doit appartenir au manga et
 * être déjà apparu ; sans première apparition vérifiée, il est écarté.
 */
export function isPlayableCharacter(character: Character, mode: SpoilerMode, animeCutoff?: number): boolean {
  const chapter = character.debut?.chapter;
  return character.canon && chapter != null && chapter <= chapterLimit(mode, animeCutoff);
}

export function isPlayableFruit(fruit: Fruit, mode: SpoilerMode, animeCutoff?: number): boolean {
  const chapter = fruit.debut?.chapter;
  return chapter != null && chapter <= chapterLimit(mode, animeCutoff);
}

/** Le personnage tel que le connaît un joueur dans ce mode : faits postérieurs retirés. */
export function viewCharacter(character: Character, mode: SpoilerMode, animeCutoff?: number): Character {
  const known = <T extends { since: number | null }>(facts: T[]) =>
    facts.filter((fact) => isKnown(fact.since, mode, animeCutoff));
  return {
    ...character,
    origin: character.origin && isKnown(character.origin.since, mode, animeCutoff) ? character.origin : null,
    bounties: known(character.bounties),
    epithets: known(character.epithets),
    affiliations: known(character.affiliations),
    occupations: known(character.occupations),
  };
}

/** Prime en vigueur (la plus récente connue), `null` si le personnage n'en a pas. */
export function currentBounty(character: Character): number | null {
  return character.bounties[0]?.amount ?? null;
}
