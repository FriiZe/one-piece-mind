/** Échanges d'avis de recherche entre amis : ce qu'en sait l'interface. */
import type { CollectionEntry } from "@/lib/economy";
import type { Localized } from "@/lib/i18n";

/** Propositions qu'un joueur peut avoir en attente, et qu'il peut envoyer par jour. */
export const TRADE_LIMITS = { pending: 10, perDay: 20 };

export type TradeView = {
  id: string;
  /** L'autre joueur : celui qui propose, ou celui à qui on a proposé. */
  friend: string;
  /** Avis que donne celui qui a fait la proposition. */
  offeredId: string;
  /** Avis qu'il demande en retour. */
  requestedId: string;
  createdAt: number;
};

export type TradesOverview = {
  /** Propositions reçues, en attente de réponse. */
  incoming: TradeView[];
  /** Propositions envoyées, pas encore acceptées. */
  outgoing: TradeView[];
};

/** Collection d'un ami, pour choisir ce qu'on lui demande. */
export type FriendCollection = { id: string; username: string; collection: Record<string, CollectionEntry> };

export type TradeError =
  | "unavailable"
  | "not-friends"
  | "not-owned"
  | "friend-not-owned"
  | "same"
  | "already"
  | "limit"
  | "not-found"
  /** L'un des deux avis a quitté sa collection depuis la proposition. */
  | "gone";
export type TradeResult = { ok: true } | { ok: false; error: TradeError };

export const TRADE_ERRORS: Localized<Record<TradeError, string>> = {
  fr: {
    unavailable: "Échange indisponible pour l'instant.",
    "not-friends": "Vous n'êtes pas amis.",
    "not-owned": "Tu n'as pas cet avis.",
    "friend-not-owned": "Ton ami n'a pas, ou plus, cet avis.",
    same: "Choisis deux avis différents.",
    already: "Tu as déjà proposé cet échange.",
    limit: "Trop de propositions en attente. Annules-en une, ou réessaie demain.",
    "not-found": "Cette proposition n'existe plus.",
    gone: "L'un des deux avis n'est plus disponible : la proposition est annulée.",
  },
  en: {
    unavailable: "Trading is unavailable right now.",
    "not-friends": "You two aren't friends.",
    "not-owned": "You don't have that poster.",
    "friend-not-owned": "Your friend doesn't have that poster, or no longer does.",
    same: "Pick two different posters.",
    already: "You've already offered this trade.",
    limit: "Too many pending offers. Cancel one, or try again tomorrow.",
    "not-found": "That offer no longer exists.",
    gone: "One of the two posters is no longer available: the offer has been canceled.",
  },
};
