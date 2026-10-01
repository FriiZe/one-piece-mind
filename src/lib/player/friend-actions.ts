"use server";

/** Actions sur la liste d'amis. Chacune vérifie la session : elles peuvent être appelées directement. */
import type { FriendResult } from "@/lib/multi/friends";
import { answerFriendRequest, cancelFriendRequest, removeFriend, requestFriend } from "@/lib/server/friends";
import { allowAttempt, currentUser } from "@/lib/server/session";

const UNAVAILABLE: FriendResult = { ok: false, error: "unavailable" };

export async function requestFriendAction(username: string): Promise<FriendResult> {
  const user = await currentUser();
  if (!user || typeof username !== "string" || username.length > 40) return UNAVAILABLE;
  // Évite qu'un compte serve à tester en masse l'existence de pseudos
  if (!(await allowAttempt(`friend:${user.id}`, 30, 3_600_000))) return { ok: false, error: "limit" };
  return requestFriend(user.id, username);
}

export async function answerFriendRequestAction(requestId: string, accept: boolean): Promise<FriendResult> {
  const user = await currentUser();
  if (!user || typeof requestId !== "string") return UNAVAILABLE;
  return answerFriendRequest(user.id, requestId, accept === true);
}

export async function cancelFriendRequestAction(requestId: string): Promise<FriendResult> {
  const user = await currentUser();
  if (!user || typeof requestId !== "string") return UNAVAILABLE;
  return cancelFriendRequest(user.id, requestId);
}

export async function removeFriendAction(friendId: string): Promise<FriendResult> {
  const user = await currentUser();
  if (!user || typeof friendId !== "string") return UNAVAILABLE;
  return removeFriend(user.id, friendId);
}
