import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePushSubscription, pushMessage, type PushMessage } from "@/lib/multi/push";
import { accountsEnabled, db } from "@/lib/server/db";
import { answerFriendRequest, friendsOverview, requestFriend } from "@/lib/server/friends";
import { DUMMY_HASH } from "@/lib/server/password";
import { notify, removePushSubscriptions, savePushSubscription } from "@/lib/server/push";
import { answerTrade, proposeTrade, tradesOverview } from "@/lib/server/trades";

// Aucun message ne part vraiment : on regarde ce que le serveur aurait envoyé, et à qui
const send = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??= "cle-publique-de-test";
  process.env.VAPID_PRIVATE_KEY ??= "cle-privee-de-test";
  return vi.fn();
});
vi.mock("web-push", () => ({ default: { sendNotification: send } }));

const keys = { p256dh: "BPubliqueDuNavigateur_-", auth: "secret_-" };

describe("messages des notifications", () => {
  it("s'écrit dans la langue du joueur et mène à la bonne page", () => {
    expect(pushMessage({ type: "friend-request", from: "Nami" }, "fr")).toEqual({
      title: "Demande d'ami",
      body: "Nami te demande en ami.",
      url: "/profil#amis",
      tag: "friend-request:Nami",
    });
    expect(pushMessage({ type: "trade-proposed", from: "Nami" }, "en")).toMatchObject({
      title: "Trade offer",
      body: "Nami offers you a poster trade.",
      url: "/en/echanges",
    });
    expect(pushMessage({ type: "room-invite", from: "Zoro", code: "ABC23" }, "en").url).toBe("/en/multi/ABC23");
    expect(pushMessage({ type: "trade-accepted", from: "Zoro" }, "fr").url).toBe("/collection");
    expect(pushMessage({ type: "quiz-hidden", title: "Les sabres" }, "fr").body).toContain("« Les sabres »");
  });

  it("n'accepte que l'abonnement d'un vrai service de notification", () => {
    const valid = (endpoint: string) => parsePushSubscription({ endpoint, keys });
    expect(valid("https://fcm.googleapis.com/fcm/send/abc")).toEqual({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys });
    expect(valid("https://updates.push.services.mozilla.com/wpush/v2/abc")).not.toBeNull();
    expect(valid("https://web.push.apple.com/abc")).not.toBeNull();
    expect(valid("https://db5p.notify.windows.com/w/?token=abc")).not.toBeNull();

    // Le serveur écrit à cette adresse : elle ne doit pas pouvoir désigner une autre machine
    expect(valid("http://fcm.googleapis.com/fcm/send/abc")).toBeNull();
    expect(valid("https://fcm.googleapis.com.exemple.fr/abc")).toBeNull();
    expect(valid("https://exemple.fr/fcm.googleapis.com")).toBeNull();
    expect(valid("https://fcm.googleapis.com:8443/abc")).toBeNull();
    expect(valid("https://localhost/abc")).toBeNull();
    expect(valid("pas une adresse")).toBeNull();

    expect(parsePushSubscription(null)).toBeNull();
    expect(parsePushSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/abc" })).toBeNull();
    expect(parsePushSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "a b", auth: "c" } })).toBeNull();
  });
});

describe.skipIf(!accountsEnabled)("envoi des notifications, en base", () => {
  const stamp = Date.now();
  const users: { id: string; username: string }[] = [];
  const endpoint = (name: string) => `https://fcm.googleapis.com/fcm/send/test-${stamp}-${name}`;
  const session = (user: number) => `session-test-${stamp}-${user}`;
  /** Messages partis depuis le dernier relevé, avec l'adresse de l'appareil visé. */
  const sent = () => send.mock.calls.map(([subscription, payload]) => ({ to: subscription.endpoint as string, ...(JSON.parse(payload) as PushMessage) }));

  beforeAll(async () => {
    for (const name of ["luffy", "nami"]) {
      const username = `${name}_${stamp % 1_000_000}`;
      const user = await db().user.create({ data: { username, usernameKey: username, passwordHash: DUMMY_HASH }, select: { id: true, username: true } });
      await db().session.create({ data: { id: session(users.length), userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) } });
      users.push(user);
    }
  });
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ statusCode: 201 });
  });
  afterAll(async () => {
    await db().user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await db().$disconnect();
  });

  it("prévient le destinataire d'une demande d'ami, dans sa langue, puis celui qui l'a envoyée", async () => {
    const [a, b] = users;
    await savePushSubscription(session(1), { endpoint: endpoint("nami"), keys }, "en");

    expect(await requestFriend(a.id, b.username)).toEqual({ ok: true });
    expect(sent()).toEqual([
      { to: endpoint("nami"), title: "Friend request", body: `${a.username} sent you a friend request.`, url: "/en/profil#amis", tag: `friend-request:${a.username}` },
    ]);
    expect(send.mock.calls[0][0].keys).toEqual(keys);

    // Celui qui a demandé n'a activé les notifications nulle part : l'acceptation ne part vers personne
    send.mockClear();
    const [request] = (await friendsOverview(b.id)).incoming;
    expect(await answerFriendRequest(b.id, request.id, true)).toEqual({ ok: true, accepted: true });
    expect(sent()).toEqual([]);
  });

  it("prévient des échanges : la proposition, puis la réponse", async () => {
    const [a, b] = users;
    await savePushSubscription(session(0), { endpoint: endpoint("luffy"), keys }, "fr");
    await db().collectionEntry.createMany({
      data: [
        { userId: a.id, characterId: "monkey-d-luffy", count: 1 },
        { userId: b.id, characterId: "nami", count: 1 },
      ],
    });

    expect(await proposeTrade(a.id, b.id, "monkey-d-luffy", "nami")).toEqual({ ok: true });
    expect(sent()).toMatchObject([{ to: endpoint("nami"), title: "Trade offer", url: "/en/echanges" }]);

    send.mockClear();
    const [trade] = (await tradesOverview(b.id)).incoming;
    expect(await answerTrade(b.id, trade.id, true)).toEqual({ ok: true });
    expect(sent()).toMatchObject([{ to: endpoint("luffy"), title: "Échange accepté", body: expect.stringContaining(b.username), url: "/collection" }]);
  });

  it("ne garde qu'un abonnement par navigateur, et le rattache à la session qui le présente", async () => {
    const [a, b] = users;
    await savePushSubscription(session(1), { endpoint: endpoint("nami-2"), keys }, "fr");
    expect((await db().pushSubscription.findMany({ where: { sessionId: session(1) } })).map((s) => s.endpoint)).toEqual([endpoint("nami-2")]);

    // Un autre joueur se connecte sur le même navigateur : c'est lui qu'on prévient désormais
    await savePushSubscription(session(0), { endpoint: endpoint("nami-2"), keys }, "fr");
    await notify(b.id, { type: "friend-request", from: "Zoro" });
    expect(sent()).toEqual([]);
    await notify(a.id, { type: "friend-request", from: "Zoro" });
    expect(sent().map((message) => message.to)).toEqual([endpoint("nami-2")]);
  });

  it("oublie un abonnement résilié, et ne fait jamais échouer l'action", async () => {
    const [a, b] = users;
    await savePushSubscription(session(1), { endpoint: endpoint("nami-3"), keys }, "fr");
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Service de notification en panne : l'abonnement reste, l'appel se termine sans erreur
    send.mockRejectedValue(Object.assign(new Error("panne"), { statusCode: 500 }));
    await expect(notify(b.id, { type: "trade-declined", from: a.username })).resolves.toBeUndefined();
    expect(await db().pushSubscription.count({ where: { sessionId: session(1) } })).toBe(1);
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();

    send.mockRejectedValue(Object.assign(new Error("résilié"), { statusCode: 410 }));
    await notify(b.id, { type: "trade-declined", from: a.username });
    expect(await db().pushSubscription.count({ where: { sessionId: session(1) } })).toBe(0);
  });

  it("ne prévient plus un appareil dont la session est fermée ou expirée", async () => {
    const [a] = users;
    await db().session.update({ where: { id: session(0) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await notify(a.id, { type: "friend-request", from: "Zoro" });
    expect(sent()).toEqual([]);

    await db().session.update({ where: { id: session(0) }, data: { expiresAt: new Date(Date.now() + 3_600_000) } });
    await removePushSubscriptions(session(0));
    await savePushSubscription(session(0), { endpoint: endpoint("luffy-2"), keys }, "fr");
    // Déconnexion : la session disparaît, l'abonnement avec elle
    await db().session.delete({ where: { id: session(0) } });
    expect(await db().pushSubscription.count({ where: { endpoint: endpoint("luffy-2") } })).toBe(0);
  });
});
