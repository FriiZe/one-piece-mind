/**
 * Règles communes aux deux jeux d'image mystère : « Révélation » (image
 * pixelisée qui se précise) et « Zoom extrême » (détail qui dézoome). L'image
 * passe par six paliers ; plus on trouve tôt, plus on marque.
 */
import type { PlayCharacter } from "../cards";
import { sample, type Rng } from "../engine/rng";

export type Variant = "pixel" | "zoom";
export type Pictured = PlayCharacter & { img: string };

/** Nombre de paliers avant l'image nette. */
export const STEPS = 6;
/** Durée d'un palier, en secondes, avant de passer seul au suivant. */
export const STEP_SECONDS = 5;
export const ROUNDS = 8;
export const MAX_SCORE = ROUNDS * STEPS;

/** Révélation : nombre de pavés sur la largeur de l'image, à chaque palier. */
export const PIXEL_COLUMNS = [5, 8, 12, 18, 28, 44] as const;
/** Zoom extrême : grossissement à chaque palier. */
export const ZOOM_FACTORS = [5, 3.8, 2.8, 2.1, 1.6, 1.25] as const;

/** Points d'une image trouvée au palier donné (0 = le plus flou) : de 6 à 1. */
export function pointsFor(step: number): number {
  return Math.max(1, STEPS - step);
}

export function pictured(characters: readonly PlayCharacter[]): Pictured[] {
  return characters.filter((c): c is Pictured => c.img !== null);
}

export function generateRounds(rng: Rng, characters: readonly PlayCharacter[], count = ROUNDS): Pictured[] {
  return sample(rng, pictured(characters), count);
}

/**
 * Point visé par le zoom, en proportion de l'image. Tiré dans la moitié haute
 * et au centre : c'est là que se trouve le visage sur un portrait.
 */
export function zoomFocus(rng: Rng): { x: number; y: number } {
  return { x: 0.3 + rng() * 0.4, y: 0.2 + rng() * 0.35 };
}

/** Partie de l'image à afficher pour un grossissement donné, sans déborder du cadre. */
export function zoomWindow(width: number, height: number, focus: { x: number; y: number }, factor: number) {
  const w = width / factor;
  const h = height / factor;
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
  return { x: clamp(focus.x * width - w / 2, width - w), y: clamp(focus.y * height - h / 2, height - h), width: w, height: h };
}
