import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildGameData, resolveGameData } from "@/games/cards";
import { dailyKey } from "@/games/engine/daily";
import { createRng } from "@/games/engine/rng";
import * as dle from "@/games/onepiecedle/logic";
import * as typeDeFruit from "@/games/type-de-fruit/logic";
import { DAILY_CHALLENGE_BERRYS, dailyGames, TAVERN_COST } from "@/lib/economy";
import { accountsEnabled, db } from "@/lib/server/db";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/server/password";
import { buyRecruitFor, loadState, sanitizeGuestState, setCrewFor, submitGame } from "@/lib/server/player";

const data = resolveGameData(buildGameData(), "anime");

describe("mots de passe", () => {
  it("vérifie le bon mot de passe et refuse les autres", async () => {
    const hash = await hashPassword("un mot de passe correct");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("un mot de passe correct");
    expect(await verifyPassword("un mot de passe correct", hash)).toBe(true);
    expect(await verifyPassword("un mot de passe incorrect", hash)).toBe(false);
    expect(await verifyPassword("peu importe", DUMMY_HASH)).toBe(false);
    expect(await verifyPassword("peu importe", "empreinte illisible")).toBe(false);
  });

  it("donne deux empreintes différentes au même mot de passe", async () => {
    expect(await hashPassword("identique")).not.toBe(await hashPassword("identique"));
  });
});

describe("reprise de la progression d'un invité", () => {
  it("plafonne les Berrys et ne garde que des personnages connus", () => {
    const clean = sanitizeGuestState({
      berrys: 9_000_000,
      lifetimeBerrys: 9_000_000,
      games: 12,
      collection: {
        "monkey-d-luffy": { count: 999, golden: 999 },
        nami: { count: 2, golden: 1 },
        "personnage-invente": { count: 1, golden: 0 },
      },
      crew: { capitaine: "monkey-d-luffy", navigateur: "monkey-d-luffy", sabreur: "roronoa-zoro", amiral: "nami" },
    })!;
    expect(clean.berrys).toBe(100_000);
    expect(clean.lifetimeBerrys).toBe(500_000);
    expect(clean.collection).toEqual([
      { characterId: "monkey-d-luffy", count: 50, golden: 50 },
      { characterId: "nami", count: 2, golden: 1 },
    ]);
    // Un personnage par poste, possédé, à un poste qui existe
    expect(clean.crew).toEqual([{ post: "capitaine", characterId: "monkey-d-luffy" }]);
  });

  it("refuse un état mal formé", () => {
    expect(sanitizeGuestState(null)).toBeNull();
    expect(sanitizeGuestState({ berrys: -5, lifetimeBerrys: 0, games: 0, collection: {}, crew: {} })).toBeNull();
    expect(sanitizeGuestState({ berrys: "beaucoup" })).toBeNull();
  });

  it("ne laisse pas un solde dépasser le total gagné", () => {
    const clean = sanitizeGuestState({ berrys: 5000, lifetimeBerrys: 100, games: 0, collection: {}, crew: {} })!;
    expect(clean.berrys).toBe(100);
  });
});

// Ces tests écrivent dans la base locale (docker compose up -d) ; ils sont ignorés sans DATABASE_URL.
describe.skipIf(!accountsEnabled)("récompenses enregistrées en base", () => {
  let userId: string;
  const username = `test_${Date.now()}`;

  beforeAll(async () => {
    const user = await db().user.create({
      data: { username, usernameKey: username, passwordHash: DUMMY_HASH },
      select: { id: true },
    });
    userId = user.id;
  });
  afterAll(async () => {
    await db().user.delete({ where: { id: userId } });
    await db().$disconnect();
  });

  const perfectFruitQuiz = (seed: number) => ({
    slug: "type-de-fruit",
    seed,
    mode: "anime",
    answers: typeDeFruit.generateQuiz(createRng(seed), data.fruits).map((f) => typeDeFruit.familyOf(f.type)),
  });

  /** Un jour où « Type de fruit » est jeu du jour : seuls les jeux du jour rapportent des Berrys. */
  const fruitDay = (() => {
    for (let i = 0; i < 400; i++) {
      const day = new Date(Date.parse("2026-10-01T00:00:00Z") + i * 86_400_000).toISOString().slice(0, 10);
      if (dailyGames(day).includes("type-de-fruit")) return day;
    }
    throw new Error("Type de fruit n'est jamais jeu du jour");
  })();

  it("recalcule le score, crédite les Berrys et refuse la même partie une seconde fois", async () => {
    const first = await submitGame(userId, perfectFruitQuiz(101), fruitDay);
    if (!first.ok) throw new Error(first.reason);
    expect(first.outcome).toMatchObject({ score: 10, max: 10 });
    expect(first.reward.berrys).toBe(250);
    // Première partie parfaite : les objectifs du jeu s'ajoutent aux gains
    expect(first.reward.objectives.map((o) => o.label)).toContain("Réussir un sans-faute");
    expect(first.reward.total).toBeGreaterThan(first.reward.berrys);
    expect(first.state).toMatchObject({ berrys: first.reward.total, lifetimeBerrys: first.reward.total, games: 1 });
    expect(first.state.stats["type-de-fruit"]).toEqual({ games: 1, best: 1 });

    expect(await submitGame(userId, perfectFruitQuiz(101), fruitDay)).toEqual({ ok: false, reason: "duplicate" });
    // Une autre partie du même jeu, le même jour : acceptée, mais le jeu du jour est déjà validé
    const again = await submitGame(userId, perfectFruitQuiz(103), fruitDay);
    if (!again.ok) throw new Error(again.reason);
    expect(again.reward).toMatchObject({ daily: "done", berrys: 0, recruit: null });
    expect(again.state.day).toMatchObject({ key: fruitDay, done: ["type-de-fruit"] });
    const reloaded = await loadState(userId);
    expect(reloaded.berrys).toBe(first.reward.total + again.reward.total);
    expect(reloaded.day).toEqual(again.state.day);
    // Le parcours par jeu et les défis de la semaine sont bien relus depuis la base
    expect(reloaded.stats).toEqual(again.state.stats);
    expect(reloaded.week).toEqual(again.state.week);
  });

  it("ignore un score annoncé par le navigateur et refuse un compte rendu mal formé", async () => {
    const forged = { ...perfectFruitQuiz(102), answers: [], score: 10, berrys: 999_999 };
    const result = await submitGame(userId, forged);
    if (!result.ok) throw new Error(result.reason);
    expect(result.outcome.score).toBe(0);
    expect(result.reward.berrys).toBe(0);

    expect(await submitGame(userId, { slug: "type-de-fruit", seed: "abc" })).toEqual({ ok: false, reason: "invalid" });
    expect(await submitGame(userId, { slug: "trouve-les-tous", seed: 1, mode: "anime", groupId: "inconnu", found: [] })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("paie le défi du jour une seule fois, avec un recrutement assuré", async () => {
    const today = dailyKey();
    const report = { slug: "onepiecedle-daily", day: today, mode: "anime", guesses: [dle.dailyTarget(data.characters, today).id] };
    const before = await loadState(userId);
    const won = await submitGame(userId, report);
    if (!won.ok) throw new Error(won.reason);
    expect(won.reward.berrys).toBe(DAILY_CHALLENGE_BERRYS);
    expect(won.reward.recruit).not.toBeNull();
    expect(won.state.berrys).toBe(before.berrys + won.reward.total);
    expect(won.state.collection[won.reward.recruit!.characterId].count).toBeGreaterThanOrEqual(1);

    expect(await submitGame(userId, report)).toEqual({ ok: false, reason: "duplicate" });
    expect(await submitGame(userId, { ...report, day: "2020-01-01" })).toEqual({ ok: false, reason: "invalid" });
  });

  it("vend un recrutement tant que le solde le permet", async () => {
    await db().user.update({ where: { id: userId }, data: { berrys: TAVERN_COST + 100 } });
    const bought = await buyRecruitFor(userId, "anime");
    if (!bought.ok) throw new Error(bought.reason);
    expect(bought.state.berrys).toBe(100);
    expect(bought.state.collection[bought.recruit.characterId]).toBeDefined();
    expect(await buyRecruitFor(userId, "anime")).toEqual({ ok: false, reason: "insufficient" });
  });

  it("n'accepte au poste qu'un personnage possédé", async () => {
    const owned = Object.keys((await loadState(userId)).collection)[0];
    const assigned = await setCrewFor(userId, "capitaine", owned);
    if (!assigned.ok) throw new Error(assigned.reason);
    expect(assigned.state.crew).toEqual({ capitaine: owned });

    const moved = await setCrewFor(userId, "timonier", owned);
    expect(moved.ok && moved.state.crew).toEqual({ timonier: owned });

    const stranger = data.characters.find((c) => !(c.id in assigned.state.collection))!.id;
    expect(await setCrewFor(userId, "capitaine", stranger)).toEqual({ ok: false, reason: "not-owned" });
    expect(await setCrewFor(userId, "amiral", owned)).toEqual({ ok: false, reason: "unknown-post" });
    const freed = await setCrewFor(userId, "timonier", null);
    expect(freed.ok && freed.state.crew).toEqual({});
  });
});
