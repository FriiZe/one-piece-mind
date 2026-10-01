import { describe, expect, it } from "vitest";
import { createRng } from "@/games/engine/rng";
import {
  AFFILIATION_SYNERGY,
  applyGame,
  assignPost,
  BASE_BERRYS,
  buyRecruit,
  crewBonuses,
  DAILY_BERRY_CAP,
  DAILY_CHALLENGE_BERRYS,
  drawRecruit,
  EMPTY_PLAYER,
  playerBounty,
  POST_IDS,
  rankOf,
  recruitChance,
  tavernCost,
  type GameOutcome,
  type PlayerState,
  type Recruitable,
} from "@/lib/economy";

const pool: Recruitable[] = [
  { id: "luffy", tier: 1, affiliation: "Chapeau de paille" },
  { id: "zoro", tier: 1, affiliation: "Chapeau de paille" },
  { id: "nami", tier: 1, affiliation: "Chapeau de paille" },
  { id: "vergo", tier: 2, affiliation: "Don Quijote" },
  { id: "pell", tier: 3, affiliation: "Alabasta" },
  ...Array.from({ length: 20 }, (_, i) => ({ id: `figurant-${i}`, tier: 4, affiliation: null })),
];
const byId = new Map(pool.map((c) => [c.id, c]));
const owning = (...ids: string[]): PlayerState => ({
  ...EMPTY_PLAYER,
  collection: Object.fromEntries(ids.map((id) => [id, { count: 1, golden: 0 }])),
});

const outcome = (overrides: Partial<GameOutcome> = {}): GameOutcome => ({
  slug: "le-classement",
  category: "primes",
  score: 25,
  max: 25,
  performance: 1,
  difficulty: "normal",
  daily: false,
  ...overrides,
});
/** Tirage qui ne recrute jamais : `rng()` renvoie toujours presque 1. */
const never = () => 0.999;

describe("gains d'une partie", () => {
  it("paie le barème du jeu, modulé par la réussite et la difficulté", () => {
    const play = (o: Partial<GameOutcome>) => applyGame(EMPTY_PLAYER, outcome(o), pool, "2026-10-01", never).reward.berrys;
    expect(play({})).toBe(BASE_BERRYS["le-classement"]);
    expect(play({ performance: 0.5 })).toBe(250);
    expect(play({ difficulty: "expert" })).toBe(750);
    expect(play({ difficulty: "facile" })).toBe(350);
    expect(play({ performance: 0 })).toBe(0);
    expect(play({ slug: "onepiecedle", category: "mots", daily: true, difficulty: null })).toBe(DAILY_CHALLENGE_BERRYS);
  });

  it("crédite le solde, le total gagné et le compteur de parties", () => {
    const { state } = applyGame({ ...EMPTY_PLAYER, berrys: 100, lifetimeBerrys: 900 }, outcome(), pool, "2026-10-01", never);
    expect(state).toMatchObject({ berrys: 600, lifetimeBerrys: 1400, games: 1, day: { key: "2026-10-01", earned: 500 } });
  });

  it("plafonne les gains de la journée, puis repart le lendemain", () => {
    const almost: PlayerState = { ...EMPTY_PLAYER, day: { key: "2026-10-01", earned: DAILY_BERRY_CAP - 120 } };
    const sameDay = applyGame(almost, outcome(), pool, "2026-10-01", never);
    expect(sameDay.reward).toMatchObject({ berrys: 120, capped: true });
    expect(applyGame(sameDay.state, outcome(), pool, "2026-10-01", never).reward.berrys).toBe(0);

    const nextDay = applyGame(sameDay.state, outcome(), pool, "2026-10-02", never);
    expect(nextDay.reward).toMatchObject({ berrys: 500, capped: false });
    expect(nextDay.state.day).toEqual({ key: "2026-10-02", earned: 500 });
  });
});

describe("recrutement", () => {
  it("n'a aucune chance sous la moyenne, puis de 25 % à 60 %", () => {
    expect(recruitChance(0.49, 0)).toBe(0);
    expect(recruitChance(0.5, 0)).toBeCloseTo(0.25);
    expect(recruitChance(1, 0)).toBeCloseTo(0.6);
    expect(recruitChance(1, 0.2)).toBeCloseTo(0.72);
    expect(recruitChance(1, 5)).toBe(0.9);
  });

  it("recrute à coup sûr après un défi du jour réussi, jamais après une partie ratée", () => {
    const daily = outcome({ slug: "onepiecedle", category: "mots", daily: true, performance: 0.2 });
    // 0.95 : au-dessus de toute chance ordinaire, en dessous de la certitude
    const won = applyGame(EMPTY_PLAYER, daily, pool, "2026-10-01", () => 0.95);
    expect(won.reward.recruit).not.toBeNull();
    expect(won.state.collection[won.reward.recruit!.characterId]).toEqual({ count: 1, golden: 0 });

    const lost = applyGame(EMPTY_PLAYER, outcome({ performance: 0.2 }), pool, "2026-10-01", () => 0);
    expect(lost.reward.recruit).toBeNull();
  });

  it("respecte les raretés : les légendaires sont rares, les communs fréquents", () => {
    const rng = createRng(123);
    const tiers = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<number, number>;
    for (let i = 0; i < 4000; i++) tiers[byId.get(drawRecruit(rng, pool, EMPTY_PLAYER, 0)!.characterId)!.tier]++;
    expect(tiers[1] / 4000).toBeCloseTo(0.04, 1);
    expect(tiers[4] / 4000).toBeCloseTo(0.5, 1);
    expect(tiers[4]).toBeGreaterThan(tiers[3]);
    expect(tiers[3]).toBeGreaterThan(tiers[2]);
  });

  it("signale les doublons et les compte", () => {
    const state = owning("luffy");
    const recruit = { ...drawRecruit(() => 0, pool, state, 0)! };
    expect(recruit).toMatchObject({ characterId: "luffy", duplicate: true });
  });

  it("vend un recrutement à la taverne, réduction du musicien comprise", () => {
    expect(buyRecruit({ ...EMPTY_PLAYER, berrys: 1499 }, pool, createRng(1))).toBe("insufficient");
    expect(buyRecruit({ ...EMPTY_PLAYER, berrys: 1500 }, [], createRng(1))).toBe("empty");

    const bought = buyRecruit({ ...EMPTY_PLAYER, berrys: 2000, lifetimeBerrys: 2000 }, pool, createRng(1));
    if (typeof bought === "string") throw new Error(bought);
    expect(bought.cost).toBe(1500);
    expect(bought.state.berrys).toBe(500);
    // Dépenser ne fait pas baisser la prime
    expect(bought.state.lifetimeBerrys).toBe(2000);
    expect(bought.state.collection[bought.recruit.characterId].count).toBe(1);

    const withMusician = assignPost(owning("luffy"), "musicien", "luffy") as PlayerState;
    expect(tavernCost(crewBonuses(withMusician, byId).discount)).toBe(1200);
  });
});

describe("équipage", () => {
  it("ne place qu'un personnage possédé, à un seul poste à la fois", () => {
    const state = owning("luffy", "vergo");
    expect(assignPost(state, "capitaine", "zoro")).toBe("not-owned");
    expect(assignPost(state, "amiral", "luffy")).toBe("unknown-post");

    const captain = assignPost(state, "capitaine", "luffy") as PlayerState;
    const moved = assignPost(captain, "navigateur", "luffy") as PlayerState;
    expect(moved.crew).toEqual({ navigateur: "luffy" });
    expect((assignPost(moved, "navigateur", null) as PlayerState).crew).toEqual({});
  });

  it("donne un bonus selon le poste et la rareté, renforcé par un avis doré", () => {
    const state = assignPost(assignPost(owning("vergo", "pell"), "charpentier", "vergo") as PlayerState, "navigateur", "pell");
    const bonuses = crewBonuses(state as PlayerState, byId);
    expect(bonuses.berrys.primes).toBeCloseTo(0.14);
    expect(bonuses.recruit).toBeCloseTo(0.09);

    const golden: PlayerState = { ...EMPTY_PLAYER, collection: { vergo: { count: 1, golden: 1 } }, crew: { charpentier: "vergo" } };
    expect(crewBonuses(golden, byId).berrys.primes).toBeCloseTo(0.21);
    // Le capitaine agit sur tous les jeux, à demi-force
    const captain: PlayerState = { ...owning("luffy"), crew: { capitaine: "luffy" } };
    expect(crewBonuses(captain, byId).berrys.all).toBeCloseTo(0.1);
  });

  it("applique le bonus du poste aux gains de sa catégorie seulement", () => {
    const state: PlayerState = { ...owning("vergo"), crew: { charpentier: "vergo" } };
    const primes = applyGame(state, outcome(), pool, "2026-10-01", never).reward;
    expect(primes).toMatchObject({ berrys: 570, bonus: 70 });
    const savoir = applyGame(state, outcome({ slug: "type-de-fruit", category: "savoir" }), pool, "2026-10-01", never).reward;
    expect(savoir).toMatchObject({ berrys: 250, bonus: 0 });
  });

  it("récompense trois membres de la même affiliation et un équipage complet", () => {
    const trio: PlayerState = { ...owning("luffy", "zoro", "nami"), crew: { sabreur: "zoro", navigateur: "nami", tireur: "luffy" } };
    const bonuses = crewBonuses(trio, byId);
    expect(bonuses.sharedAffiliation).toBe("Chapeau de paille");
    expect(bonuses.berrys.all).toBeCloseTo(AFFILIATION_SYNERGY.bonus);

    const ids = pool.slice(5, 15).map((c) => c.id);
    const full: PlayerState = { ...owning(...ids), crew: Object.fromEntries(POST_IDS.map((post, i) => [post, ids[i]])) };
    expect(crewBonuses(full, byId)).toMatchObject({ full: true, sharedAffiliation: null });
  });

  it("ignore un membre que le mode spoiler du joueur ne montre pas", () => {
    const state: PlayerState = { ...owning("inconnu"), crew: { capitaine: "inconnu" } };
    expect(crewBonuses(state, byId).berrys).toEqual({});
  });
});

describe("prime du joueur", () => {
  it("suit le total gagné et fixe le rang", () => {
    expect(playerBounty({ lifetimeBerrys: 12_500 })).toBe(12_500_000);
    expect(rankOf(0)).toMatchObject({ title: "Mousse", next: { title: "Rookie" } });
    expect(rankOf(12_500_000).title).toBe("Rookie");
    expect(rankOf(499_999_999).title).toBe("Supernova");
    expect(rankOf(3_000_000_000)).toEqual({ title: "Empereur", next: null });
  });
});
