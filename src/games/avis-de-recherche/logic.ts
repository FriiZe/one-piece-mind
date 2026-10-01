import type { PlayCharacter, ResolvedData } from "../cards";
import { sample, type Rng } from "../engine/rng";
import { normalizeText } from "../engine/text";
import { SEA_LABELS } from "@/lib/data/labels";
import { bountyPool, type Bountied } from "../plus-ou-moins/logic";

export const MAX_POINTS = 5;
export type Hint = { key: "affiliation" | "sea" | "arc" | "initial"; title: string; value: string };

function initialOf(character: PlayCharacter): string {
  const letters = normalizeText(character.name).replace(/ /g, "");
  return `${character.name[0].toUpperCase()}… (${letters.length} lettres)`;
}

/** Indices d'une affiche, du plus vague au plus précis ; ceux sans valeur sont omis. */
export function hintsFor(character: PlayCharacter, data: ResolvedData): Hint[] {
  const arc = character.arc !== null ? data.arcs.get(character.arc) : undefined;
  const hints: (Hint | null)[] = [
    character.affiliation ? { key: "affiliation", title: "Affiliation", value: character.affiliation } : null,
    character.sea ? { key: "sea", title: "Mer d'origine", value: SEA_LABELS[character.sea] } : null,
    arc ? { key: "arc", title: "Première apparition", value: arc } : null,
    { key: "initial", title: "Initiale", value: initialOf(character) },
  ];
  return hints.filter((h): h is Hint => h !== null);
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

export function generatePosters(rng: Rng, characters: readonly PlayCharacter[], count = 5): Bountied[] {
  return sample(rng, bountyPool(characters), count);
}
