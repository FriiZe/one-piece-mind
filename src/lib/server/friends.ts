import "server-only";
import { playerBounty } from "@/lib/economy";
import { MAX_FRIENDS, type FriendResult, type FriendsOverview, type NotificationCounts } from "@/lib/multi/friends";
import { db } from "./db";

/** Durée de validité d'une invitation dans un salon. */
const INVITE_LIFETIME_MS = 2 * 3_600_000;

/** Invitations encore utiles : récentes, et dans un salon qui n'a pas commencé. */
const openInvites = (userId: string) => ({
  toId: userId,
  createdAt: { gte: new Date(Date.now() - INVITE_LIFETIME_MS) },
  room: { status: "lobby" },
});

/** Nombre de demandes et d'invitations en attente. `admin` : compte aussi les quiz masqués à relire. */
export async function pendingCounts(userId: string, admin: boolean): Promise<NotificationCounts> {
  const [requests, invites, hiddenQuizzes] = await Promise.all([
    db().friendship.count({ where: { addresseeId: userId, status: "pending" } }),
    db().roomInvite.count({ where: openInvites(userId) }),
    admin ? db().quiz.count({ where: { status: "hidden" } }) : 0,
  ]);
  return { requests, invites, hiddenQuizzes };
}

export async function friendsOverview(userId: string): Promise<FriendsOverview> {
  const [links, invites] = await Promise.all([
    db().friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: {
        requester: { select: { id: true, username: true, lifetimeBerrys: true } },
        addressee: { select: { id: true, username: true, lifetimeBerrys: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db().roomInvite.findMany({
      where: openInvites(userId),
      include: { room: { select: { code: true } }, from: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const overview: FriendsOverview = {
    friends: [],
    incoming: [],
    outgoing: [],
    invites: invites.map((invite) => ({ code: invite.room.code, from: invite.from.username })),
  };
  for (const link of links) {
    const sentByMe = link.requesterId === userId;
    const other = sentByMe ? link.addressee : link.requester;
    if (link.status === "accepted") {
      overview.friends.push({ id: other.id, username: other.username, bounty: playerBounty(other) });
    } else if (sentByMe) {
      overview.outgoing.push({ id: link.id, username: other.username });
    } else {
      overview.incoming.push({ id: link.id, username: other.username });
    }
  }
  overview.friends.sort((a, b) => a.username.localeCompare(b.username, "fr"));
  return overview;
}

/** Envoie une demande d'ami. Si l'autre en avait déjà envoyé une, les deux deviennent amis tout de suite. */
export async function requestFriend(userId: string, username: string): Promise<FriendResult> {
  const target = await db().user.findUnique({ where: { usernameKey: username.trim().toLowerCase() }, select: { id: true } });
  if (!target) return { ok: false, error: "unknown-user" };
  if (target.id === userId) return { ok: false, error: "self" };

  const existing = await db().friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: userId },
      ],
    },
  });
  if (existing) {
    if (existing.status === "pending" && existing.requesterId === target.id) {
      await db().friendship.update({ where: { id: existing.id }, data: { status: "accepted" } });
      return { ok: true, accepted: true };
    }
    return { ok: false, error: "already" };
  }

  const count = await db().friendship.count({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }] } });
  if (count >= MAX_FRIENDS) return { ok: false, error: "limit" };

  await db().friendship.create({ data: { requesterId: userId, addresseeId: target.id } });
  return { ok: true };
}

/** Répond à une demande reçue : seul son destinataire peut l'accepter ou la refuser. */
export async function answerFriendRequest(userId: string, requestId: string, accept: boolean): Promise<FriendResult> {
  const request = await db().friendship.findFirst({ where: { id: requestId, addresseeId: userId, status: "pending" } });
  if (!request) return { ok: false, error: "not-found" };
  if (accept) await db().friendship.update({ where: { id: request.id }, data: { status: "accepted" } });
  else await db().friendship.delete({ where: { id: request.id } });
  return { ok: true, accepted: accept };
}

/** Retire un ami, ou annule une demande envoyée. */
export async function removeFriend(userId: string, otherId: string): Promise<FriendResult> {
  const removed = await db().friendship.deleteMany({
    where: {
      OR: [
        { requesterId: userId, addresseeId: otherId },
        { requesterId: otherId, addresseeId: userId },
      ],
    },
  });
  return removed.count > 0 ? { ok: true } : { ok: false, error: "not-found" };
}

export async function cancelFriendRequest(userId: string, requestId: string): Promise<FriendResult> {
  const removed = await db().friendship.deleteMany({ where: { id: requestId, requesterId: userId, status: "pending" } });
  return removed.count > 0 ? { ok: true } : { ok: false, error: "not-found" };
}
