/**
 * Règles du marché : un joueur met en vente un exemplaire en trop d'un avis
 * de recherche, n'importe quel autre joueur l'achète en Berrys, et une taxe
 * est retenue sur la vente. Calcul pur, partagé par le serveur et l'interface.
 */
import { DUPLICATE_VALUE, GOLDEN_DUPLICATE_FACTOR, type CollectionEntry } from "@/lib/economy";

/** Part du prix retenue à la vente : ces Berrys quittent le jeu. */
export const MARKET_TAX = 0.1;
/** Annonces qu'un joueur peut avoir ouvertes en même temps. */
export const MARKET_MAX_LISTINGS = 10;
/** Annonces renvoyées par page du marché. */
export const MARKET_PAGE_SIZE = 60;
/** Les prix sont des multiples de ce pas. */
export const PRICE_STEP = 10;
/** Prix le plus haut, en multiple du prix le plus bas : limite les transferts de Berrys déguisés en vente. */
const MAX_PRICE_FACTOR = 20;
const SUGGESTED_PRICE_FACTOR = 3;

/**
 * Fourchette de prix d'un avis, selon sa rareté (1 = légendaire). Le plancher
 * est ce que rapporterait l'exemplaire en le défaisant : en dessous, autant
 * le défaire.
 */
export function priceBounds(tier: number, golden: boolean): { min: number; max: number; suggested: number } {
  const min = (DUPLICATE_VALUE[tier] ?? DUPLICATE_VALUE[4]) * (golden ? GOLDEN_DUPLICATE_FACTOR : 1);
  return { min, max: min * MAX_PRICE_FACTOR, suggested: min * SUGGESTED_PRICE_FACTOR };
}

export function isValidPrice(price: unknown, tier: number, golden: boolean): price is number {
  const { min, max } = priceBounds(tier, golden);
  return typeof price === "number" && Number.isInteger(price) && price % PRICE_STEP === 0 && price >= min && price <= max;
}

export const marketTax = (price: number) => Math.round(price * MARKET_TAX);
/** Ce que touche le vendeur. */
export const marketProceeds = (price: number) => price - marketTax(price);

/**
 * Exemplaires d'un avis que le joueur peut mettre en vente : il en garde
 * toujours un, ordinaire ou doré.
 */
export function sellableCopies(entry: CollectionEntry | undefined): { plain: number; golden: number } {
  if (!entry || entry.count < 2) return { plain: 0, golden: 0 };
  const golden = Math.min(entry.golden, entry.count);
  const plain = entry.count - golden;
  return { plain: golden > 0 ? plain : plain - 1, golden: plain > 0 ? golden : golden - 1 };
}

export const MARKET_SORTS = ["recent", "cheap", "expensive"] as const;
export type MarketSort = (typeof MARKET_SORTS)[number];
