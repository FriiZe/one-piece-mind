import type { PlayCharacter, ResolvedData } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, sample, type Rng } from "../engine/rng";
import { normalizeText, revealsName } from "../engine/text";
import { SEA_LABELS } from "@/lib/data/labels";
import { bountyPool, type Bountied } from "../plus-ou-moins/logic";

export const MAX_POINTS = 5;
export const POSTERS = 5;
export const MAX_SCORE = POSTERS * MAX_POINTS;
export type Hint = { key: "affiliation" | "sea" | "arc" | "initial"; title: string; value: string };

function initialOf(character: PlayCharacter): string {
  const letters = normalizeText(character.name).replace(/ /g, "");
  return `${character.name[0].toUpperCase()}… (${letters.length} lettres)`;
}

/** Indices d'une affiche, du plus vague au plus précis, l'initiale en dernier ; ceux sans valeur sont omis. */
export function hintsFor(character: PlayCharacter, data: ResolvedData): Hint[] {
  const arc = character.arc !== null ? data.arcs.get(character.arc) : undefined;
  const hints: (Hint | null)[] = [
    character.affiliation ? { key: "affiliation", title: "Affiliation", value: character.affiliation } : null,
    character.sea ? { key: "sea", title: "Mer d'origine", value: SEA_LABELS[character.sea] } : null,
    arc ? { key: "arc", title: "Première apparition", value: arc } : null,
  ];
  // Un indice qui contient le nom du personnage (« Équipage d'Arlong ») donnerait la réponse
  const safe = hints.filter((h): h is Hint => h !== null && !revealsName(h.value, character.name));
  return [...safe, { key: "initial", title: "Initiale", value: initialOf(character) }];
}

/** Points gagnés selon le nombre d'indices dévoilés : de 5 (aucun) à 1. */
export function pointsFor(revealed: number): number {
  return Math.max(1, MAX_POINTS - revealed);
}

/**
 * Plusieurs personnages partagent parfois la même prime. Une réponse est
 * acceptée si rien de ce qui est affiché ne la distingue du personnage attendu.
 */
export function isAccepted(guess: PlayCharacter, target: PlayCharacter, revealed: number, data: ResolvedData): boolean {
  if (guess.id === target.id) return true;
  if (guess.bounty !== target.bounty) return false;
  const shown = hintsFor(target, data).slice(0, revealed);
  const own = new Map(hintsFor(guess, data).map((h) => [h.key, h.value]));
  return shown.every((hint) => own.get(hint.key) === hint.value);
}

export function generatePosters(rng: Rng, characters: readonly PlayCharacter[], count = POSTERS): Bountied[] {
  return sample(rng, bountyPool(characters), count);
}

/** Ce que le joueur a fait sur une affiche : proposer un nom, demander un indice, passer. */
export type PosterEvent = { type: "guess"; id: string } | { type: "hint" } | { type: "pass" };

/** Points d'une affiche, en rejouant les actions du joueur dans l'ordre. */
export function scorePoster(target: PlayCharacter, events: readonly PosterEvent[], data: ResolvedData): number {
  const hints = hintsFor(target, data).length;
  let revealed = 0;
  for (const event of events) {
    if (event.type === "pass") return 0;
    if (event.type === "hint") {
      revealed = Math.min(hints, revealed + 1);
      continue;
    }
    const guess = data.characterById.get(event.id);
    if (guess && isAccepted(guess, target, revealed, data)) return pointsFor(revealed);
    // Une erreur dévoile l'indice suivant ; sans indice restant, l'affiche est perdue
    if (revealed >= hints) return 0;
    revealed++;
  }
  return 0;
}

/** Rejoue une partie à partir de sa graine et des actions du joueur, affiche par affiche. */
export function evaluate(seed: number, difficulty: Difficulty, posters: readonly (readonly PosterEvent[])[], data: ResolvedData) {
  const targets = generatePosters(createRng(seed), byDifficulty(data.characters, difficulty));
  const score = targets.reduce((sum, target, index) => sum + scorePoster(target, posters[index] ?? [], data), 0);
  return { score, max: MAX_SCORE };
}
