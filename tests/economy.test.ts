import { describe, expect, it } from "vitest";
import { createRng } from "@/games/engine/rng";
import {
  AFFILIATION_SYNERGY,
  applyGame,
  assignPost,
  BASE_BERRYS,
  buyRecruit,
  crewBonuses,
  daysLeftInWeek,
  DAILY_BERRY_CAP,
  DAILY_CHALLENGE_BERRYS,
  drawRecruit,
  EMPTY_PLAYER,
  isMet,
  normalizePlayer,
  objectiveProgress,
  OBJECTIVES,
  playerBounty,
  POST_IDS,
  rankOf,
  recruitChance,
  tavernCost,
  weekKey,
  weeklyChallenges,
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
    const { state, reward } = applyGame({ ...EMPTY_PLAYER, berrys: 100, lifetimeBerrys: 900 }, outcome(), pool, "2026-10-01", never);
    expect(reward.berrys).toBe(500);
    expect(state).toMatchObject({
      berrys: 100 + reward.total,
      lifetimeBerrys: 900 + reward.total,
      games: 1,
      // Seuls les gains de la partie comptent pour le plafond du jour, pas les primes d'objectifs
      day: { key: "2026-10-01", earned: 500 },
    });
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

describe("objectifs par jeu", () => {
  const sum = (milestones: { berrys: number }[]) => milestones.reduce((total, m) => total + m.berrys, 0);

  it("verse chaque prime une seule fois, quand l'objectif est atteint", () => {
    const first = applyGame(EMPTY_PLAYER, outcome(), pool, "2026-10-01", never);
    expect(first.reward.objectives.map((o) => o.label)).toEqual([
      "Jouer une première partie",
      "Marquer la moitié des points",
      "Marquer 80 % des points",
      "Réussir un sans-faute",
    ]);
    expect(sum(first.reward.objectives)).toBe(100 + 200 + 500 + 1500);
    expect(first.state.stats["le-classement"]).toEqual({ games: 1, best: 1 });

    const second = applyGame(first.state, outcome(), pool, "2026-10-01", never);
    expect(second.reward.objectives).toEqual([]);
    expect(second.reward.total).toBe(second.reward.berrys + sum(second.reward.weekly));
  });

  it("suit chaque jeu séparément et garde la meilleure réussite", () => {
    let state = applyGame(EMPTY_PLAYER, outcome({ performance: 0.6 }), pool, "2026-10-01", never).state;
    state = applyGame(state, outcome({ performance: 0.3 }), pool, "2026-10-01", never).state;
    expect(state.stats["le-classement"]).toEqual({ games: 2, best: 0.6 });

    const other = applyGame(state, outcome({ slug: "haki", category: "savoir", performance: 0.9 }), pool, "2026-10-01", never);
    expect(other.reward.objectives.map((o) => o.label)).toContain("Jouer une première partie");
    expect(other.state.stats.haki).toEqual({ games: 1, best: 0.9 });
  });

  it("récompense la régularité à la dixième partie", () => {
    let state = EMPTY_PLAYER;
    let tenth: ReturnType<typeof applyGame> | undefined;
    for (let i = 0; i < 10; i++) {
      tenth = applyGame(state, outcome({ performance: 0.1 }), pool, "2026-10-01", never);
      state = tenth.state;
    }
    expect(tenth!.reward.objectives).toEqual([{ label: "Jouer 10 parties", berrys: 500 }]);
    expect(isMet(OBJECTIVES[1], state.stats["le-classement"])).toBe(true);
    expect(objectiveProgress(OBJECTIVES[2], state.stats["le-classement"])).toBeCloseTo(0.2);
  });
});

describe("défis de la semaine", () => {
  it("découpe l'année en semaines qui commencent le lundi", () => {
    expect(weekKey("2026-10-01")).toBe("2026-S40");
    expect(weekKey("2026-09-28")).toBe("2026-S40");
    expect(weekKey("2026-09-27")).toBe("2026-S39");
    expect(weekKey("2026-01-01")).toBe("2026-S01");
    // Le 1er janvier 2027 est un vendredi : il appartient encore à la dernière semaine de 2026
    expect(weekKey("2027-01-01")).toBe("2026-S53");
    expect(weekKey("2027-01-04")).toBe("2027-S01");
    expect(daysLeftInWeek("2026-09-28")).toBe(7);
    expect(daysLeftInWeek("2026-10-04")).toBe(1);
  });

  it("propose trois défis, les mêmes pour tous pendant une semaine", () => {
    const challenges = weeklyChallenges("2026-S40");
    expect(challenges).toHaveLength(3);
    expect(weeklyChallenges("2026-S40").map((c) => c.label)).toEqual(challenges.map((c) => c.label));
    expect(challenges[0].slug).not.toBe(challenges[1].slug);
    expect(challenges[2].label).toBe("Réussir 3 défis du jour");
    expect(weeklyChallenges("2026-S41")[2].label).toBe("Gagner 5 000 Berrys en jouant");
  });

  it("fait avancer un défi partie après partie et le paie une fois terminé", () => {
    const [regular] = weeklyChallenges("2026-S40");
    const game = outcome({ slug: regular.slug!, category: "savoir", performance: 0.1, difficulty: null });
    let state = EMPTY_PLAYER;
    const paid: number[] = [];
    for (let i = 0; i < 6; i++) {
      const applied = applyGame(state, game, pool, "2026-10-01", never);
      state = applied.state;
      paid.push(applied.reward.weekly.filter((w) => w.label === regular.label).length);
    }
    expect(paid).toEqual([0, 0, 0, 0, 1, 0]);
    expect(state.week).toMatchObject({ key: "2026-S40" });
    expect(state.week.progress[0]).toBe(5);
    expect(state.week.done[0]).toBe(true);
  });

  it("repart de zéro la semaine suivante", () => {
    const played = applyGame(EMPTY_PLAYER, outcome(), pool, "2026-10-01", never).state;
    const nextWeek = applyGame(played, outcome({ performance: 0 }), pool, "2026-10-05", never).state;
    expect(nextWeek.week.key).toBe("2026-S41");
    expect(nextWeek.week.done).toEqual([false, false, false]);
  });

  it("complète une progression enregistrée avant l'ajout des objectifs", () => {
    const old = { berrys: 40, lifetimeBerrys: 40, games: 1, collection: {}, crew: {}, day: { key: "2026-10-01", earned: 40 } };
    const state = normalizePlayer(old);
    expect(state).toMatchObject({ berrys: 40, stats: {}, week: { key: "" } });
    expect(() => applyGame(state, outcome(), pool, "2026-10-02", never)).not.toThrow();
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
