import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildGameData, resolveGameData } from "@/games/cards";
import { evaluate as evaluateClassement } from "@/games/le-classement/logic";
import { generateMixed, MIX_SLUGS } from "@/games/qcm/logic";
import { evaluate as evaluateTypeDeFruit } from "@/games/type-de-fruit/logic";
import { targetOf, toWord } from "@/games/wordle/logic";
import {
  cleanName,
  CODE_PATTERN,
  gamePoints,
  ROOM_GAME_SLUGS,
  normalizeCode,
  pointsFor,
  randomCode,
  rank,
  roomBerrys,
  validGames,
} from "@/lib/multi/rules";
import type { RoomTicket, RoomView } from "@/lib/multi/types";
import { accountsEnabled, db } from "@/lib/server/db";
import { answerFriendRequest, friendsOverview, pendingCounts, removeFriend, requestFriend } from "@/lib/server/friends";
import { DUMMY_HASH } from "@/lib/server/password";
import { answerRoom, createRoom, finishRound, inviteToRoom, joinRoom, restartRoom, startRoom, viewRoom } from "@/lib/server/rooms";

describe("règles du multijoueur", () => {
  it("tire des codes lisibles et tolère la saisie", () => {
    let i = 0;
    const code = randomCode((max) => i++ % max);
    expect(code).toMatch(CODE_PATTERN);
    expect(code).not.toMatch(/[O0I1]/);
    expect(normalizeCode(" ab c2d ")).toBe("ABC2D");
  });

  it("accepte un pseudo raisonnable et refuse le reste", () => {
    expect(cleanName("  Zoro   le perdu ")).toBe("Zoro le perdu");
    expect(cleanName("Kin'emon")).toBe("Kin'emon");
    expect(cleanName("Z")).toBeNull();
    expect(cleanName("x".repeat(17))).toBeNull();
    expect(cleanName("<script>")).toBeNull();
    expect(cleanName("nom‮piégé")).toBeNull();
  });

  it("n'accepte que des quiz existants", () => {
    expect(validGames(["haki", "haki", "navires"])).toEqual(["haki", "navires"]);
    expect(validGames([])).toBeNull();
    expect(validGames(["mode-aleatoire"])).toBeNull();
    expect(validGames("haki")).toBeNull();
    // Les autres jeux se jouent aussi en salon, sauf ceux que le serveur ne peut pas vérifier
    expect(validGames(["wordle", "grille", "haki"])).toEqual(["wordle", "grille", "haki"]);
    expect(validGames(["den-den-devin"])).toBeNull();
    expect(ROOM_GAME_SLUGS).toContain("le-classement");
    expect(ROOM_GAME_SLUGS).not.toContain("haki");
  });

  it("note une manche hors QCM selon la part du score maximal", () => {
    expect(gamePoints(1)).toBe(1000);
    expect(gamePoints(5 / 6)).toBe(833);
    expect(gamePoints(0)).toBe(0);
    expect(gamePoints(2)).toBe(1000);
  });

  it("ne note qu'une unité d'un jeu en plusieurs manches", () => {
    const data = resolveGameData(buildGameData(), "anime");
    expect(evaluateClassement(1, "normal", [], data.characters).max).toBe(25);
    expect(evaluateClassement(1, "normal", [], data.characters, 1).max).toBe(5);
    expect(evaluateTypeDeFruit(1, [], data.fruits, 1).max).toBe(1);
  });

  it("récompense la bonne réponse, et la rapidité", () => {
    expect(pointsFor(false, 0, 15_000)).toBe(0);
    expect(pointsFor(true, 0, 15_000)).toBe(1000);
    expect(pointsFor(true, 7_500, 15_000)).toBe(750);
    expect(pointsFor(true, 15_000, 15_000)).toBe(500);
    expect(pointsFor(true, 99_000, 15_000)).toBe(500);
  });

  it("classe par score, les ex æquo au même rang", () => {
    const ranking = rank([
      { id: "a", score: 500, joinedAt: 3 },
      { id: "b", score: 900, joinedAt: 2 },
      { id: "c", score: 500, joinedAt: 1 },
      { id: "d", score: 100, joinedAt: 0 },
    ]);
    expect(ranking.map((p) => [p.id, p.rank])).toEqual([["b", 1], ["c", 2], ["a", 2], ["d", 4]]);
  });

  it("paie selon les points marqués et le podium, jamais un joueur seul", () => {
    expect(roomBerrys(10_000, 10, 1, 4)).toBe(900);
    expect(roomBerrys(5_000, 10, 2, 4)).toBe(450);
    expect(roomBerrys(5_000, 10, 4, 4)).toBe(300);
    expect(roomBerrys(0, 10, 1, 4)).toBe(0);
    expect(roomBerrys(10_000, 10, 1, 1)).toBe(0);
  });

  it("tire des questions toutes différentes dans les quiz choisis", () => {
    const data = resolveGameData(buildGameData(), "anime");
    const questions = generateMixed(5, ["haki", "navires"], 15, "normal", data);
    expect(questions).toHaveLength(15);
    expect(new Set(questions.map((q) => q.id)).size).toBe(15);
    expect(questions.every((q) => q.id.startsWith("haki:") || q.id.startsWith("navires:"))).toBe(true);
    expect(generateMixed(5, [...MIX_SLUGS], 10, "normal", data)).toEqual(generateMixed(5, [...MIX_SLUGS], 10, "normal", data));
  });
});

// Ces tests écrivent dans la base locale ; ils sont ignorés sans DATABASE_URL.
describe.skipIf(!accountsEnabled)("salon et amis, en base", () => {
  const stamp = Date.now();
  const users: { id: string; username: string }[] = [];
  const settings = { mode: "anime", difficulty: "normal", games: ["haki", "equipage"], questionCount: 5, seconds: 15 };
  let host: RoomTicket;
  let guest: RoomTicket;
  let code: string;

  beforeAll(async () => {
    for (const name of ["hote", "ami"]) {
      // Pseudos courts : un invité (16 caractères au plus) doit pouvoir tenter de prendre le même
      const username = `${name}_${stamp % 1_000_000}`;
      users.push(await db().user.create({ data: { username, usernameKey: username, passwordHash: DUMMY_HASH }, select: { id: true, username: true } }));
    }
  });
  afterAll(async () => {
    await db().room.deleteMany({ where: { code } });
    await db().user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await db().$disconnect();
  });

  /** Avance l'horloge du salon en reculant ses échéances. */
  async function elapse(ms: number) {
    const room = await db().room.findUniqueOrThrow({ where: { code } });
    await db().room.update({
      where: { id: room.id },
      data: {
        phaseStartedAt: room.phaseStartedAt && new Date(room.phaseStartedAt.getTime() - ms),
        phaseEndsAt: room.phaseEndsAt && new Date(room.phaseEndsAt.getTime() - ms),
      },
    });
  }
  async function view(ticket: RoomTicket): Promise<RoomView> {
    const result = await viewRoom(ticket);
    if (!result.ok || !("view" in result)) throw new Error("vue indisponible");
    return result.view;
  }
  async function questions() {
    const room = await db().room.findUniqueOrThrow({ where: { code } });
    return generateMixed(room.seed, ["haki", "equipage"], 5, "normal", resolveGameData(buildGameData(), "anime"));
  }

  it("crée un salon et laisse entrer un invité avec un pseudo libre", async () => {
    expect(await createRoom({ ...settings, questionCount: 7 }, { user: users[0] })).toEqual({ ok: false, error: "bad-request" });
    expect(await createRoom(settings, { user: null, name: "x" })).toEqual({ ok: false, error: "bad-name" });

    const created = await createRoom(settings, { user: users[0] });
    if (!created.ok) throw new Error(created.error);
    host = created.ticket;
    code = host.code;
    expect(code).toMatch(CODE_PATTERN);

    expect(await joinRoom("ZZZZZ", { user: null, name: "Zoro" })).toEqual({ ok: false, error: "not-found" });
    expect(await joinRoom(code, { user: null, name: users[0].username.toUpperCase() })).toEqual({ ok: false, error: "name-taken" });
    const joined = await joinRoom(code.toLowerCase(), { user: null, name: "Zoro le perdu" });
    if (!joined.ok) throw new Error(joined.error);
    guest = joined.ticket;

    const lobby = await view(host);
    expect(lobby).toMatchObject({ status: "lobby", question: null, you: { isHost: true } });
    expect(lobby.players.map((p) => p.name)).toEqual([users[0].username, "Zoro le perdu"]);
    expect((await view(guest)).you.isHost).toBe(false);
  });

  it("refuse un jeton qui n'est pas le bon", async () => {
    expect(await viewRoom({ ...guest, token: "faux" })).toEqual({ ok: false, error: "not-found" });
    expect(await startRoom({ ...host, token: guest.token })).toEqual({ ok: false, error: "not-found" });
  });

  it("ne laisse que l'hôte lancer la partie, puis ferme les entrées", async () => {
    expect(await startRoom(guest)).toEqual({ ok: false, error: "forbidden" });
    expect(await startRoom(host)).toEqual({ ok: true });
    expect(await joinRoom(code, { user: null, name: "Retardataire" })).toEqual({ ok: false, error: "started" });
  });

  it("envoie la question sans sa réponse, puis la correction quand tout le monde a répondu", async () => {
    const [first] = await questions();
    const asked = await view(guest);
    expect(asked.question).toMatchObject({ index: 0, total: 5, reveal: null, yourAnswer: null });
    expect(JSON.stringify(asked)).not.toContain("answerId");
    expect(JSON.stringify(asked)).not.toContain(first.explanation);

    const wrong = first.options.find((o) => o.id !== first.answerId)!.id;
    expect(await answerRoom(host, 0, first.answerId)).toEqual({ ok: true });
    expect(await answerRoom(host, 0, wrong)).toEqual({ ok: true });
    expect(await answerRoom(guest, 3, wrong)).toEqual({ ok: false, error: "forbidden" });
    expect(await answerRoom(guest, 0, "option-inconnue")).toEqual({ ok: false, error: "bad-request" });

    const waiting = await view(guest);
    expect(waiting.question?.reveal).toBeNull();
    expect(waiting.players.find((p) => p.isHost)).toMatchObject({ answered: true, score: 0 });

    expect(await answerRoom(guest, 0, wrong)).toEqual({ ok: true });
    const revealed = await view(guest);
    expect(revealed.question?.reveal).toMatchObject({ answerId: first.answerId, yourPoints: 0, counts: { [first.answerId]: 1, [wrong]: 1 } });
    // La seconde réponse de l'hôte a été ignorée : il garde les points de la première
    const hostView = await view(host);
    expect(hostView.question?.reveal?.yourPoints).toBeGreaterThanOrEqual(900);
    expect(hostView.players[0]).toMatchObject({ isHost: true, rank: 1 });
  });

  it("ne renvoie rien à un joueur déjà à jour", async () => {
    const current = await view(host);
    expect(await viewRoom(host, current.version)).toMatchObject({ ok: true, unchanged: true });
    expect(await viewRoom(host, current.version - 1)).toHaveProperty("view");
  });

  it("passe à la suite quand le temps est écoulé, jusqu'à la fin de la partie", async () => {
    await elapse(7_000);
    const second = await view(host);
    expect(second.question).toMatchObject({ index: 1, reveal: null, yourAnswer: null });

    // Personne ne répond plus : chaque question expire, puis sa correction
    for (let step = 0; step < 12 && (await view(host)).status === "playing"; step++) await elapse(16_000);
    const finished = await view(host);
    expect(finished).toMatchObject({ status: "finished", question: null });
    expect(await answerRoom(host, 4, "peu-importe")).toEqual({ ok: false, error: "forbidden" });
  });

  it("verse une fois les Berrys au joueur connecté, rien à l'invité", async () => {
    const finished = await view(host);
    const score = finished.players.find((p) => p.isHost)!.score;
    const expected = roomBerrys(score, 5, 1, 2);
    expect(expected).toBeGreaterThan(300);
    expect(finished.reward).toEqual({ berrys: expected });
    expect((await view(host)).reward).toEqual({ berrys: expected });
    expect((await view(guest)).reward).toBeNull();

    // Le compte, créé pour ce test, n'a rien gagné d'autre : plusieurs lectures du salon n'ont payé qu'une fois
    const account = await db().user.findUniqueOrThrow({ where: { id: users[0].id } });
    expect(account).toMatchObject({ berrys: expected, lifetimeBerrys: expected, games: 1 });
  });

  it("relie deux joueurs par une demande d'ami acceptée", async () => {
    const [a, b] = users;
    expect(await requestFriend(a.id, "personne_inconnue")).toEqual({ ok: false, error: "unknown-user" });
    expect(await requestFriend(a.id, a.username)).toEqual({ ok: false, error: "self" });
    expect(await requestFriend(a.id, b.username.toUpperCase())).toEqual({ ok: true });
    expect(await requestFriend(a.id, b.username)).toEqual({ ok: false, error: "already" });

    const pending = await friendsOverview(b.id);
    expect(pending.incoming).toMatchObject([{ username: a.username }]);
    expect((await friendsOverview(a.id)).outgoing).toMatchObject([{ username: b.username }]);
    // La cloche du destinataire compte la demande ; celle de l'expéditeur, rien
    expect(await pendingCounts(b.id, false)).toEqual({ requests: 1, invites: 0, trades: 0, hiddenQuizzes: 0, sales: 0, loot: 0 });
    expect(await pendingCounts(a.id, false)).toEqual({ requests: 0, invites: 0, trades: 0, hiddenQuizzes: 0, sales: 0, loot: 0 });
    // Seul le destinataire peut répondre
    expect(await answerFriendRequest(a.id, pending.incoming[0].id, true)).toEqual({ ok: false, error: "not-found" });
    expect(await answerFriendRequest(b.id, pending.incoming[0].id, true)).toEqual({ ok: true, accepted: true });

    const friends = await friendsOverview(a.id);
    expect(friends).toMatchObject({ friends: [{ id: b.id, username: b.username }], incoming: [], outgoing: [] });
    expect(friends.friends[0].bounty).toBeGreaterThanOrEqual(0);
    expect((await pendingCounts(b.id, false)).requests).toBe(0);
  });

  it("relance le salon, puis y invite un ami", async () => {
    expect(await restartRoom(guest)).toEqual({ ok: false, error: "forbidden" });
    expect(await restartRoom(host)).toEqual({ ok: true });
    const lobby = await view(host);
    expect(lobby.status).toBe("lobby");
    expect(lobby.players.every((p) => p.score === 0)).toBe(true);

    const [a, b] = users;
    expect(await inviteToRoom(guest, null, b.id)).toEqual({ ok: false, error: "forbidden" });
    expect(await inviteToRoom(host, a, "quelqu-un-d-autre")).toEqual({ ok: false, error: "forbidden" });
    expect(await inviteToRoom(host, a, b.id)).toEqual({ ok: true });
    expect((await friendsOverview(b.id)).invites).toEqual([{ code, from: a.username }]);
    expect(await pendingCounts(b.id, false)).toMatchObject({ requests: 0, invites: 1 });

    // L'ami invité entre avec son compte : son pseudo est celui du compte
    const joined = await joinRoom(code, { user: b });
    if (!joined.ok) throw new Error(joined.error);
    expect((await view(joined.ticket)).players.map((p) => p.name)).toContain(b.username);

    expect(await removeFriend(b.id, a.id)).toEqual({ ok: true });
    expect((await friendsOverview(a.id)).friends).toEqual([]);
    expect(await inviteToRoom(host, a, b.id)).toEqual({ ok: false, error: "forbidden" });
  });
});

describe.skipIf(!accountsEnabled)("manches hors QCM, en base", () => {
  const settings = { mode: "anime", difficulty: "normal", games: ["wordle"], questionCount: 5, seconds: 15 };
  let host: RoomTicket;
  let guest: RoomTicket;
  let code: string;

  afterAll(async () => {
    await db().room.deleteMany({ where: { code } });
    await db().$disconnect();
  });

  async function view(ticket: RoomTicket): Promise<RoomView> {
    const result = await viewRoom(ticket);
    if (!result.ok || !("view" in result)) throw new Error("vue indisponible");
    return result.view;
  }

  it("joue une manche Wordle sans chrono, notée au nombre d'essais", async () => {
    const created = await createRoom(settings, { user: null, name: "Nami" });
    if (!created.ok) throw new Error(created.error);
    host = created.ticket;
    code = host.code;
    const joined = await joinRoom(code, { user: null, name: "Usopp" });
    if (!joined.ok) throw new Error(joined.error);
    guest = joined.ticket;
    expect(await startRoom(host)).toEqual({ ok: true });

    const round = (await view(guest)).question;
    if (round?.kind !== "game") throw new Error("manche attendue");
    expect(round).toMatchObject({ index: 0, total: 5, slug: "wordle", done: false, reveal: null });

    // Une manche hors QCM ne se répond pas comme un QCM, et le compte rendu doit être celui de la manche
    expect(await answerRoom(host, 0, "peu-importe")).toEqual({ ok: false, error: "forbidden" });
    const data = resolveGameData(buildGameData(), "anime");
    const target = toWord(targetOf(round.seed, "normal", data.characters).name);
    const report = { slug: "wordle", seed: round.seed, mode: "anime", difficulty: "normal", guesses: [target] };
    expect(await finishRound(host, 0, { ...report, seed: round.seed + 1 })).toEqual({ ok: false, error: "bad-request" });
    expect(await finishRound(host, 0, { ...report, difficulty: "expert" })).toEqual({ ok: false, error: "bad-request" });
    expect(await finishRound(host, 0, { ...report, slug: "anagramme", answers: [] })).toEqual({ ok: false, error: "bad-request" });

    // Pas de chrono : même longtemps après, la manche attend toujours les joueurs
    const room = await db().room.findUniqueOrThrow({ where: { code } });
    await db().room.update({
      where: { id: room.id },
      data: { phaseStartedAt: new Date(room.phaseStartedAt!.getTime() - 120_000), phaseEndsAt: new Date(room.phaseEndsAt!.getTime() - 120_000) },
    });
    expect(await finishRound(host, 0, report)).toEqual({ ok: true });
    const waiting = await view(guest);
    expect(waiting.question).toMatchObject({ index: 0, reveal: null });
    expect(waiting.players.find((p) => p.name === "Nami")).toMatchObject({ answered: true, score: 0 });

    // L'invité abandonne : tout le monde a fini, les résultats s'affichent
    expect(await finishRound(guest, 0, null)).toEqual({ ok: true });
    const revealed = await view(host);
    if (revealed.question?.kind !== "game") throw new Error("manche attendue");
    const ids = Object.fromEntries(revealed.players.map((p) => [p.name, p.id]));
    expect(revealed.question.reveal).toMatchObject({ yourPoints: 1000, results: { [ids.Nami]: 1000, [ids.Usopp]: null } });
    expect(revealed.players[0]).toMatchObject({ name: "Nami", score: 1000, rank: 1 });
  });
});
