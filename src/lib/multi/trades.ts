/** Échanges d'avis de recherche entre amis : ce qu'en sait l'interface. */
import type { CollectionEntry } from "@/lib/economy";

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

export const TRADE_ERRORS: Record<TradeError, string> = {
  unavailable: "Échange indisponible pour l'instant.",
  "not-friends": "Vous n'êtes pas amis.",
  "not-owned": "Tu n'as pas cet avis.",
  "friend-not-owned": "Ton ami n'a pas, ou plus, cet avis.",
  same: "Choisis deux avis différents.",
  already: "Tu as déjà proposé cet échange.",
  limit: "Trop de propositions en attente. Annules-en une, ou réessaie demain.",
  "not-found": "Cette proposition n'existe plus.",
  gone: "L'un des deux avis n'est plus disponible : la proposition est annulée.",
};
