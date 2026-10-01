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

export type FriendError = "unknown-user" | "self" | "already" | "limit" | "not-found" | "unavailable";
export type FriendResult = { ok: true; accepted?: boolean } | { ok: false; error: FriendError };

export const MAX_FRIENDS = 100;
