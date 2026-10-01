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
};

export type FriendError = "unknown-user" | "self" | "already" | "limit" | "not-found" | "unavailable";
export type FriendResult = { ok: true; accepted?: boolean } | { ok: false; error: FriendError };

export const MAX_FRIENDS = 100;
