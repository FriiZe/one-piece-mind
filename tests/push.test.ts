import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGameData, resolveGameData } from "@/games/cards";
import { generateMixed, MIX_SLUGS } from "@/games/qcm/logic";
import { weekKey } from "@/lib/economy";
import { parsePushSubscription, pushMessage, type PushMessage } from "@/lib/multi/push";
import { RAID_QUESTIONS, raidBoss } from "@/lib/raid/rules";
import { accountsEnabled, db } from "@/lib/server/db";
import { establish } from "./established";
import { answerFriendRequest, friendsOverview, requestFriend } from "@/lib/server/friends";
import { buyListing, createListing } from "@/lib/server/market";
import { DUMMY_HASH } from "@/lib/server/password";
import { notify, removePushSubscriptions, savePushSubscription } from "@/lib/server/push";
import { finishRaidAttack, startRaidAttack } from "@/lib/server/raid";
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

    const sale = { type: "market-sold", from: "Zoro", listingId: "annonce-1", character: { fr: "Baggy", en: "Buggy" }, golden: true, proceeds: 1800 } as const;
    expect(pushMessage(sale, "en")).toEqual({
      title: "Poster sold on the market",
      body: "Zoro bought your golden Buggy poster: +1,800 ฿.",
      url: "/en/marche",
      tag: "market-sold:annonce-1",
    });
    expect(pushMessage({ ...sale, golden: false }, "fr").body).toMatch(/^Zoro a acheté ton avis de Baggy : \+1\s800 ฿\.$/);

    expect(pushMessage({ type: "raid-defeated", week: "2026-S40", boss: { fr: "Kaido", en: "Kaidou" } }, "fr")).toEqual({
      title: "Raid vaincu !",
      body: "Kaido est tombé : ton butin t'attend.",
      url: "/raid",
      tag: "raid-defeated:2026-S40",
    });
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
      // Échanges et marché ne sont ouverts qu'aux comptes qui ont joué plusieurs jours
      await establish(user.id);
      users.push(user);
    }
  });
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ statusCode: 201 });
  });
  // Des semaines de raid que rien d'autre n'utilise
  const raidDays = ["2032-06-09", "2032-06-16"];
  afterAll(async () => {
    await db().raid.deleteMany({ where: { week: { in: raidDays.map(weekKey) } } });
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

    expect(await proposeTrade(a.id, b.id, { id: "monkey-d-luffy", golden: false }, { id: "nami", golden: false })).toEqual({ ok: true });
    expect(sent()).toMatchObject([{ to: endpoint("nami"), title: "Trade offer", url: "/en/echanges" }]);

    send.mockClear();
    const [trade] = (await tradesOverview(b.id)).incoming;
    expect(await answerTrade(b.id, trade.id, true)).toEqual({ ok: true });
    expect(sent()).toMatchObject([{ to: endpoint("luffy"), title: "Échange accepté", body: expect.stringContaining(b.username), url: "/collection" }]);
  });

  it("prévient le vendeur quand son annonce du marché est achetée", async () => {
    const [a, b] = users;
    // Après l'échange, le premier joueur a l'avis de Nami : il en reçoit un second, qu'il met en vente
    await db().collectionEntry.update({ where: { userId_characterId: { userId: a.id, characterId: "nami" } }, data: { count: 2 } });
    await db().user.update({ where: { id: b.id }, data: { berrys: 5000 } });
    expect((await createListing(a.id, "nami", false, 2000)).ok).toBe(true);
    const listing = await db().marketListing.findFirstOrThrow({ where: { sellerId: a.id, status: "active" } });
    // Mettre en vente ne prévient personne
    expect(sent()).toEqual([]);

    expect((await buyListing(b.id, listing.id)).ok).toBe(true);
    expect(sent()).toEqual([
      {
        to: endpoint("luffy"),
        title: "Avis vendu au marché",
        body: expect.stringMatching(new RegExp(`^${b.username} a acheté ton avis de Nami : \\+1\\s800 ฿\\.$`)),
        url: "/marche",
        tag: `market-sold:${listing.id}`,
      },
    ]);

    // Un achat refusé ne prévient pas le vendeur
    send.mockClear();
    expect(await buyListing(b.id, listing.id)).toEqual({ ok: false, error: "gone" });
    expect(sent()).toEqual([]);
  });

  it("prévient ceux qui ont droit au butin quand l'adversaire du raid tombe, sauf celui qui l'achève", async () => {
    const [a, b] = users;
    const anime = resolveGameData(buildGameData("en"), "anime");

    /** Le second joueur a déjà infligé `damage` ; le premier lance un assaut sans faute, qui achève l'adversaire. */
    async function defeat(day: string, damage: number) {
      const week = weekKey(day);
      const started = await startRaidAttack(a.id, "anime", "en", day);
      if (!started.ok) throw new Error(started.error);
      await db().raidParticipant.create({ data: { week, userId: b.id, damage, attacks: 1 } });
      await db().raid.update({ where: { week }, data: { hp: damage + 1000, damage } });
      const attack = await db().raidAttack.findUniqueOrThrow({ where: { id: started.attackId } });
      const answers = generateMixed(attack.seed, MIX_SLUGS, RAID_QUESTIONS, "normal", anime).map((question) => question.answerId);
      expect(await finishRaidAttack(a.id, started.attackId, answers)).toMatchObject({ ok: true, finisher: true });
      return week;
    }

    // Les deux joueurs ont un appareil abonné ; seul celui qui n'est pas devant son écran est prévenu
    const week = await defeat(raidDays[0], 900);
    const boss = anime.characterById.get(raidBoss(week).id)!.name;
    expect(sent()).toEqual([
      { to: endpoint("nami"), title: "Raid won!", body: `${boss} has fallen: your loot is waiting.`, url: "/en/raid", tag: `raid-defeated:${week}` },
    ]);

    // Trop peu de dégâts pour prétendre au butin : rien à annoncer
    send.mockClear();
    await defeat(raidDays[1], 100);
    expect(sent()).toEqual([]);
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
