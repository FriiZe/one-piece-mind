/** Marché : ce qu'en sait l'interface. */
import type { ExchangeAccess, PlayerState } from "@/lib/economy";
import type { Localized } from "@/lib/i18n";

export type ListingView = {
  id: string;
  characterId: string;
  golden: boolean;
  price: number;
  seller: string;
  /** Annonce du joueur lui-même : il ne peut pas l'acheter. */
  mine: boolean;
  createdAt: number;
};

/** Vente conclue, vue par le vendeur. */
export type SaleView = {
  id: string;
  characterId: string;
  golden: boolean;
  price: number;
  /** Ce que le vendeur a touché, taxe déduite. */
  proceeds: number;
  buyer: string | null;
  soldAt: number;
  /** Vente que le vendeur n'avait pas encore vue. */
  fresh: boolean;
};

export type MarketOverview = {
  listings: ListingView[];
  /** Nombre d'annonces qui correspondent aux filtres, au-delà de la page renvoyée. */
  total: number;
  /** Annonces et ventes récentes du joueur connecté ; `null` pour un visiteur. */
  mine: { active: ListingView[]; sales: SaleView[] } | null;
  /** Vendre et acheter ne s'ouvrent qu'aux comptes qui ont joué plusieurs jours ; `null` pour un visiteur. */
  access: ExchangeAccess | null;
};

export type MarketError =
  | "unavailable"
  | "unknown-character"
  /** Pas d'exemplaire en trop à vendre. */
  | "not-sellable"
  | "bad-price"
  /** Trop d'annonces ouvertes. */
  | "limit"
  | "not-found"
  /** Annonce déjà vendue ou retirée. */
  | "gone"
  | "own-listing"
  | "insufficient"
  /** Le compte n'a pas encore joué assez de jours pour vendre ou acheter. */
  | "locked";

export type MarketResult = { ok: true; state: PlayerState } | { ok: false; error: MarketError };

export const MARKET_ERRORS: Localized<Record<MarketError, string>> = {
  fr: {
    unavailable: "Le marché est indisponible pour l'instant.",
    "unknown-character": "Cet avis n'existe pas.",
    "not-sellable": "Tu n'as pas d'exemplaire en trop de cet avis.",
    "bad-price": "Ce prix sort de la fourchette autorisée.",
    limit: "Tu as trop d'annonces ouvertes. Retires-en une d'abord.",
    "not-found": "Cette annonce n'existe plus.",
    gone: "Cette annonce vient d'être vendue ou retirée.",
    "own-listing": "C'est ta propre annonce.",
    insufficient: "Pas assez de Berrys.",
    locked: "Le marché n'est pas encore ouvert à ton compte : il faut d'abord avoir joué plusieurs jours.",
  },
  en: {
    unavailable: "The market is unavailable right now.",
    "unknown-character": "That poster doesn't exist.",
    "not-sellable": "You don't have a spare copy of that poster.",
    "bad-price": "That price is outside the allowed range.",
    limit: "You have too many open listings. Take one down first.",
    "not-found": "That listing no longer exists.",
    gone: "That listing has just been sold or taken down.",
    "own-listing": "That's your own listing.",
    insufficient: "Not enough Berries.",
    locked: "The market isn't open to your account yet: you need to have played on several days first.",
  },
};
