import type { Localized } from "@/lib/i18n";

/** Ce que l'interface sait des amis du joueur connecté. */
export type FriendView = { id: string; username: string; bounty: number };
export type FriendRequestView = { id: string; username: string };
export type RoomInviteView = { code: string; from: string };

export type FriendsOverview = {
  friends: FriendView[];
  /** Demandes reçues, en attente de réponse. */
  incoming: FriendRequestView[];
  /** Demandes envoyées, pas encore acceptées. */
  outgoing: FriendRequestView[];
  /** Salons en attente où un ami t'invite. */
  invites: RoomInviteView[];
};

/** Ce qui attend une réponse du joueur : c'est ce que compte la cloche de l'en-tête. */
export type NotificationCounts = {
  /** Demandes d'ami reçues. */
  requests: number;
  /** Invitations dans un salon encore ouvert. */
  invites: number;
  /** Échanges d'avis proposés par un ami. */
  trades: number;
  /** Quiz de la communauté masqués, à relire : pour les administrateurs seulement. */
  hiddenQuizzes: number;
  /** Annonces du marché vendues, que le vendeur n'a pas encore vues. */
  sales: number;
  /** Butins de raid à récupérer. */
  loot: number;
};

export type FriendError = "unknown-user" | "self" | "already" | "limit" | "not-found" | "unavailable";
export type FriendResult = { ok: true; accepted?: boolean } | { ok: false; error: FriendError };

export const MAX_FRIENDS = 100;

export const FRIEND_ERRORS: Localized<Record<FriendError, string>> = {
  fr: {
    "unknown-user": "Aucun joueur ne porte ce pseudo.",
    self: "C'est ton propre pseudo.",
    already: "Vous êtes déjà amis, ou une demande est déjà en attente.",
    limit: "Trop de demandes pour l'instant. Réessaie plus tard.",
    "not-found": "Cette demande n'existe plus.",
    unavailable: "Action indisponible pour l'instant.",
  },
  en: {
    "unknown-user": "No player has that username.",
    self: "That's your own username.",
    already: "You're already friends, or a request is already pending.",
    limit: "Too many requests for now. Try again later.",
    "not-found": "This request no longer exists.",
    unavailable: "This action is unavailable right now.",
  },
};
