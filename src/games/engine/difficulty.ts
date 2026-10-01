import type { PlayCharacter } from "../cards";
import type { Localized } from "@/lib/i18n";

export type Difficulty = "facile" | "normal" | "expert";

export const DIFFICULTIES: { id: Difficulty; label: Localized; hint: Localized; maxTier: number }[] = [
  {
    id: "facile",
    label: { fr: "Facile", en: "Easy" },
    hint: { fr: "Les personnages que tout le monde connaît", en: "The characters everyone knows" },
    maxTier: 1,
  },
  {
    id: "normal",
    label: { fr: "Normal", en: "Normal" },
    hint: { fr: "Avec les seconds rôles", en: "Supporting characters included" },
    maxTier: 2,
  },
  {
    id: "expert",
    label: { fr: "Expert", en: "Expert" },
    hint: { fr: "Tout le monde, figurants compris", en: "Everyone, down to the extras" },
    maxTier: 4,
  },
];

export function byDifficulty(characters: readonly PlayCharacter[], difficulty: Difficulty): PlayCharacter[] {
  const { maxTier } = DIFFICULTIES.find((d) => d.id === difficulty)!;
  return characters.filter((c) => c.tier <= maxTier);
}
