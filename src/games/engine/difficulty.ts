import type { PlayCharacter } from "../cards";

export type Difficulty = "facile" | "normal" | "expert";

export const DIFFICULTIES: { id: Difficulty; label: string; hint: string; maxTier: number }[] = [
  { id: "facile", label: "Facile", hint: "Les personnages que tout le monde connaît", maxTier: 1 },
  { id: "normal", label: "Normal", hint: "Avec les seconds rôles", maxTier: 2 },
  { id: "expert", label: "Expert", hint: "Tout le monde, figurants compris", maxTier: 4 },
];

export function byDifficulty(characters: readonly PlayCharacter[], difficulty: Difficulty): PlayCharacter[] {
  const { maxTier } = DIFFICULTIES.find((d) => d.id === difficulty)!;
  return characters.filter((c) => c.tier <= maxTier);
}
