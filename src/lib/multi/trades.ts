/** Échanges d'avis de recherche entre amis : ce qu'en sait l'interface. */
import type { CollectionEntry, ExchangeAccess } from "@/lib/economy";
import type { Localized } from "@/lib/i18n";

/**
 * Propositions qu'un joueur peut avoir en attente, qu'il peut envoyer par jour,
 * et avis de chaque côté d'un échange au plus.
 */
export const TRADE_LIMITS = { pending: 10, perDay: 20, perSide: 5 };
/** Échanges conclus gardés dans l'historique de l'onglet. */
export const TRADE_HISTORY_SHOWN = 10;

/** Des exemplaires d'une version d'un avis, ordinaire ou dorée, d'un côté d'un échange. */
export type TradeLine = { id: string; golden: boolean; count: number };

export const tradeLineKey = (line: { id: string; golden: boolean }) => `${line.id}:${line.golden ? "golden" : "plain"}`;

/**
 * Un côté d'un échange remis au propre : une ligne par version, au moins un avis
 * et pas plus que la limite. `null` si la liste ne tient pas.
 */
export function normalizeTradeSide(lines: unknown): TradeLine[] | null {
  if (!Array.isArray(lines) || lines.length > TRADE_LIMITS.perSide) return null;
  const merged = new Map<string, TradeLine>();
  for (const line of lines) {
    if (typeof line !== "object" || line === null) return null;
    const { id, golden, count } = line as Record<string, unknown>;
    if (typeof id !== "string" || id.length === 0 || id.length > 80) return null;
    if (typeof golden !== "boolean" || !Number.isInteger(count) || (count as number) < 1) return null;
    const key = tradeLineKey({ id, golden });
    merged.set(key, { id, golden, count: (merged.get(key)?.count ?? 0) + (count as number) });
  }
  const total = [...merged.values()].reduce((sum, line) => sum + line.count, 0);
  if (total < 1 || total > TRADE_LIMITS.perSide) return null;
  return [...merged.values()].sort((a, b) => tradeLineKey(a).localeCompare(tradeLineKey(b)));
}

export type TradeView = {
  id: string;
  /** L'autre joueur : celui qui propose, ou celui à qui on a proposé. */
  friend: string;
  /** Avis que donne celui qui a fait la proposition. */
  offered: TradeLine[];
  /** Avis qu'il demande en retour. */
  requested: TradeLine[];
  createdAt: number;
};

/** Un échange conclu : accepté, refusé, ou annulé avant réponse. */
export type TradeHistoryEntry = TradeView & {
  status: "accepted" | "declined" | "cancelled";
  answeredAt: number;
  /** C'est le joueur qui l'avait proposé. */
  mine: boolean;
  /** Issue d'une de ses propositions que le joueur n'avait pas encore vue. */
  fresh: boolean;
};

export type TradesOverview = {
  /** Propositions reçues, en attente de réponse. */
  incoming: TradeView[];
  /** Propositions envoyées, pas encore acceptées. */
  outgoing: TradeView[];
  /** Derniers échanges conclus, dans un sens comme dans l'autre, du plus récent au plus ancien. */
  history: TradeHistoryEntry[];
  /** Les échanges ne s'ouvrent qu'aux comptes qui ont joué plusieurs jours. */
  access: ExchangeAccess;
};

/** Collection d'un ami, pour choisir ce qu'on lui demande. */
export type FriendCollection = { id: string; username: string; collection: Record<string, CollectionEntry> };

export type TradeError =
  | "unavailable"
  | "not-friends"
  | "not-owned"
  | "friend-not-owned"
  | "same"
  /** Un côté de l'échange est vide, ou dépasse la limite d'avis. */
  | "bad-size"
  | "already"
  | "limit"
  | "not-found"
  /** Le compte n'a pas encore joué assez de jours pour échanger ; `friend-locked` : celui de l'ami. */
  | "locked"
  | "friend-locked"
  /** L'un des avis a quitté sa collection depuis la proposition. */
  | "gone";
export type TradeResult = { ok: true } | { ok: false; error: TradeError };

export const TRADE_ERRORS: Localized<Record<TradeError, string>> = {
  fr: {
    unavailable: "Échange indisponible pour l'instant.",
    "not-friends": "Vous n'êtes pas amis.",
    "not-owned": "Tu n'as pas, ou plus, tous ces avis.",
    "friend-not-owned": "Ton ami n'a pas, ou plus, tous ces avis.",
    same: "Un même avis ne peut pas être des deux côtés de l'échange.",
    "bad-size": `Choisis de 1 à ${TRADE_LIMITS.perSide} avis de chaque côté.`,
    already: "Tu as déjà proposé cet échange.",
    limit: "Trop de propositions en attente. Annules-en une, ou réessaie demain.",
    "not-found": "Cette proposition n'existe plus.",
    locked: "Les échanges ne sont pas encore ouverts à ton compte : il faut d'abord avoir joué plusieurs jours.",
    "friend-locked": "Le compte de ton ami est trop récent pour échanger : il doit d'abord avoir joué plusieurs jours.",
    gone: "L'un des avis n'est plus disponible : la proposition est annulée.",
  },
  en: {
    unavailable: "Trading is unavailable right now.",
    "not-friends": "You two aren't friends.",
    "not-owned": "You don't have all those posters, or no longer do.",
    "friend-not-owned": "Your friend doesn't have all those posters, or no longer does.",
    same: "The same poster can't be on both sides of the trade.",
    "bad-size": `Pick 1 to ${TRADE_LIMITS.perSide} posters on each side.`,
    already: "You've already offered this trade.",
    limit: "Too many pending offers. Cancel one, or try again tomorrow.",
    "not-found": "That offer no longer exists.",
    locked: "Trades aren't open to your account yet: you need to have played on several days first.",
    "friend-locked": "Your friend's account is too new to trade: they need to have played on several days first.",
    gone: "One of the posters is no longer available: the offer has been canceled.",
  },
};
