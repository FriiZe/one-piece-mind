import type { GameCategoryId } from "@/lib/games/catalog";

/** Couleurs des catégories de jeux dans les images de partage : les mêmes que les pastilles du site (GameBadge). */
export const OG_TONES: Record<GameCategoryId, { background: string; color: string }> = {
  oeil: { background: "#1d4a63", color: "#8fd0f0" },
  oreille: { background: "#40295f", color: "#d2b0f5" },
  mots: { background: "#5a2f24", color: "#f5a88a" },
  primes: { background: "#1c4a44", color: "#8fe0d2" },
  savoir: { background: "#2a3466", color: "#aab8ff" },
  defis: { background: "#5a2545", color: "#f5a3cb" },
};
