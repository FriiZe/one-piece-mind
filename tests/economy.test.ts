import { describe, expect, it } from "vitest";
import { createRng } from "@/games/engine/rng";
import {
  applyGame,
  DAILY_CHALLENGE,
  DAILY_GAMES,
  dailyGames,
  SIGNUP_BERRYS,
  assignPost,
  BASE_BERRYS,
  buyRecruit,
  bonusLabel,
  crewBonuses,
  DEFAULT_TRAIT,
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
  postStrength,
  TRAIT_STEPS,
  TRAITS,
  rankOf,
  OFF_DAY_RECRUIT_CHANCE,
  recruitChance,
  tavernCost,
  weekKey,
  weeklyChallenges,
  type GameOutcome,
  type PlayerState,
  type Recruitable,
} from "@/lib/economy";
import { isRewardless, type LiveSlug } from "@/lib/games/catalog";

const pool: Recruitable[] = [
  { id: "luffy", tier: 1, org: "Chapeau de paille", affiliation: "Chapeau de paille" },
  { id: "zoro", tier: 1, org: "Chapeau de paille", affiliation: "Chapeau de paille" },
  { id: "nami", tier: 1, org: "Chapeau de paille", affiliation: "Chapeau de paille" },
  { id: "vergo", tier: 2, org: "Don Quijote", affiliation: "Don Quijote" },
  { id: "pell", tier: 3, org: "Alabasta", affiliation: "Alabasta" },
  ...Array.from({ length: 20 }, (_, i) => ({ id: `figurant-${i}`, tier: 4, org: null, affiliation: null })),
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
/** Premier jour, à partir d'une date, où ce jeu fait partie des jeux du jour. */
function dayWith(slug: LiveSlug, from = "2026-10-01"): string {
  for (let i = 0; i < 400; i++) {
    const day = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    if (dailyGames(day).includes(slug)) return day;
  }
  throw new Error(`${slug} n'est jamais jeu du jour`);
}
/** Deux jours où « Le classement », le jeu des exemples, rapporte des Berrys ; et un jour où il n'en rapporte pas. */
const DAY = dayWith("le-classement");
const LATER = dayWith("le-classement", new Date(Date.parse(`${DAY}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10));
const OFF_DAY = (() => {
  for (let i = 1; i < 400; i++) {
    const day = new Date(Date.parse(`${DAY}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    if (!dailyGames(day).includes("le-classement")) return day;
  }
  throw new Error("pas de jour sans Le classement");
})();

/** Tirage qui ne recrute jamais : `rng()` renvoie toujours presque 1. */
const never = () => 0.999;

describe("gains d'une partie", () => {
  it("paie le barème du jeu, modulé par la réussite et la difficulté", () => {
    const play = (o: Partial<GameOutcome>) => applyGame(EMPTY_PLAYER, outcome(o), pool, DAY, never).reward.berrys;
    expect(play({})).toBe(BASE_BERRYS["le-classement"]);
    expect(play({ performance: 0.5 })).toBe(250);
    expect(play({ difficulty: "expert" })).toBe(750);
    expect(play({ difficulty: "facile" })).toBe(350);
    // Sous la moitié des points, le jeu du jour n'est pas validé : rien n'est versé
    expect(play({ performance: 0.4 })).toBe(0);
    expect(play({ performance: 0 })).toBe(0);
    expect(play({ slug: "onepiecedle", category: "mots", daily: true, difficulty: null })).toBe(DAILY_CHALLENGE_BERRYS);
  });

  it("crédite le solde, le total gagné et le compteur de parties", () => {
    const { state, reward } = applyGame({ ...EMPTY_PLAYER, berrys: 100, lifetimeBerrys: 900 }, outcome(), pool, DAY, never);
    expect(reward.berrys).toBe(500);
    expect(state).toMatchObject({
      berrys: 100 + reward.total,
      lifetimeBerrys: 900 + reward.total,
      games: 1,
      // Seuls les gains de la partie comptent pour le plafond du jour, pas les primes d'objectifs
      day: { key: DAY, earned: 500, done: ["le-classement"] },
    });
  });

  it("plafonne les gains de la journée, puis repart le lendemain", () => {
    const almost: PlayerState = { ...EMPTY_PLAYER, day: { key: DAY, earned: DAILY_BERRY_CAP - 120, done: [] } };
    const sameDay = applyGame(almost, outcome(), pool, DAY, never);
    expect(sameDay.reward).toMatchObject({ berrys: 120, capped: true });
    expect(applyGame(sameDay.state, outcome(), pool, DAY, never).reward.berrys).toBe(0);

    const nextDay = applyGame(sameDay.state, outcome(), pool, LATER, never);
    expect(nextDay.reward).toMatchObject({ berrys: 500, capped: false });
    expect(nextDay.state.day).toEqual({ key: LATER, earned: 500, done: ["le-classement"] });
  });
});

describe("jeux du jour", () => {
  it("tire cinq jeux par jour, les mêmes pour tous, sans OnePiecedle ni jeu sans récompense", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const day = new Date(Date.parse("2026-10-01T00:00:00Z") + i * 86_400_000).toISOString().slice(0, 10);
      const games = dailyGames(day);
      expect(games).toHaveLength(DAILY_GAMES);
      expect(new Set(games).size).toBe(DAILY_GAMES);
      expect(dailyGames(day)).toEqual(games);
      expect(games).not.toContain("onepiecedle");
      expect(games.some(isRewardless)).toBe(false);
      games.forEach((slug) => seen.add(slug));
    }
    // La sélection tourne : en deux mois, presque tout le catalogue y passe
    expect(seen.size).toBeGreaterThan(25);
  });

  it("ne verse pas de Berrys pour un jeu hors sélection, mais compte la partie", () => {
    const played = applyGame(EMPTY_PLAYER, outcome(), pool, OFF_DAY, never);
    expect(played.reward).toMatchObject({ daily: "off", berrys: 0, recruit: null });
    expect(played.state.day).toEqual({ key: OFF_DAY, earned: 0, done: [] });
    // Les objectifs du jeu restent dus : ils ne dépendent pas de la sélection du jour
    expect(played.reward.objectives.length).toBeGreaterThan(0);
    expect(played.state.stats["le-classement"]).toEqual({ games: 1, best: 1 });
    expect(played.state.games).toBe(1);
  });

  it("laisse une chance sur cinq de recruter après une partie réussie hors sélection", () => {
    const under = () => OFF_DAY_RECRUIT_CHANCE - 0.01;
    const lucky = applyGame(EMPTY_PLAYER, outcome({ performance: 0.5 }), pool, OFF_DAY, under);
    expect(lucky.reward).toMatchObject({ daily: "off", berrys: 0 });
    expect(lucky.reward.recruit).not.toBeNull();
    expect(lucky.state.collection[lucky.reward.recruit!.characterId].count).toBe(1);
    // La recrue ne valide rien : le jeu n'entre pas dans les jeux du jour
    expect(lucky.state.day.done).toEqual([]);

    expect(applyGame(EMPTY_PLAYER, outcome(), pool, OFF_DAY, () => OFF_DAY_RECRUIT_CHANCE).reward.recruit).toBeNull();
    // Sous la moitié des points, la partie n'est pas réussie : aucune chance
    expect(applyGame(EMPTY_PLAYER, outcome({ performance: 0.49 }), pool, OFF_DAY, () => 0).reward.recruit).toBeNull();
  });

  it("paie un jeu du jour une seule fois, et seulement à partir de la moitié des points", () => {
    const missed = applyGame(EMPTY_PLAYER, outcome({ performance: 0.3 }), pool, DAY, never);
    expect(missed.reward).toMatchObject({ daily: "missed", berrys: 0 });
    expect(missed.state.day.done).toEqual([]);

    // Une partie ratée ne ferme rien : la suivante peut valider le jeu
    const passed = applyGame(missed.state, outcome({ performance: 0.5 }), pool, DAY, never);
    expect(passed.reward).toMatchObject({ daily: "paid", berrys: 250 });
    expect(passed.state.day.done).toEqual(["le-classement"]);

    const again = applyGame(passed.state, outcome(), pool, DAY, () => 0);
    expect(again.reward).toMatchObject({ daily: "done", berrys: 0, recruit: null });
    expect(again.state.day).toEqual(passed.state.day);

    // Le lendemain où le jeu revient dans la sélection, il paie de nouveau
    expect(applyGame(again.state, outcome(), pool, LATER, never).reward).toMatchObject({ daily: "paid", berrys: 500 });
  });

  it("paie le défi du jour une fois, en plus des cinq jeux", () => {
    const challenge = outcome({ slug: "onepiecedle", category: "mots", daily: true, difficulty: null });
    const won = applyGame(EMPTY_PLAYER, challenge, pool, DAY, never);
    expect(won.reward).toMatchObject({ daily: "paid", berrys: DAILY_CHALLENGE_BERRYS });
    expect(won.state.day.done).toEqual([DAILY_CHALLENGE]);
    expect(applyGame(won.state, challenge, pool, DAY, never).reward).toMatchObject({ daily: "done", berrys: 0 });
    // La partie libre d'OnePiecedle, elle, n'est jamais un jeu du jour
    expect(applyGame(EMPTY_PLAYER, { ...challenge, daily: false }, pool, DAY, never).reward.daily).toBe("off");
    expect(SIGNUP_BERRYS).toBe(500);
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
    const won = applyGame(EMPTY_PLAYER, daily, pool, DAY, () => 0.95);
    expect(won.reward.recruit).not.toBeNull();
    expect(won.state.collection[won.reward.recruit!.characterId]).toEqual({ count: 1, golden: 0 });

    const lost = applyGame(EMPTY_PLAYER, outcome({ performance: 0.2 }), pool, DAY, () => 0);
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
    const primes = applyGame(state, outcome(), pool, DAY, never).reward;
    expect(primes).toMatchObject({ berrys: 570, bonus: 70 });
    const savoir = applyGame(state, outcome({ slug: "type-de-fruit", category: "savoir" }), pool, dayWith("type-de-fruit"), never).reward;
    expect(savoir).toMatchObject({ berrys: 250, bonus: 0 });
  });

  it("récompense trois membres de la même affiliation et un équipage complet", () => {
    const trio: PlayerState = { ...owning("luffy", "zoro", "nami"), crew: { sabreur: "zoro", navigateur: "nami", tireur: "luffy" } };
    const bonuses = crewBonuses(trio, byId);
    // Une affiliation sans trait à elle partage le trait commun
    expect(bonuses.traits).toMatchObject([{ affiliation: "Chapeau de paille", name: DEFAULT_TRAIT.name, count: 3, level: 1 }]);
    expect(bonuses.berrys.all).toBeCloseTo(DEFAULT_TRAIT.values[0]);

    const ids = pool.slice(5, 15).map((c) => c.id);
    const full: PlayerState = { ...owning(...ids), crew: Object.fromEntries(POST_IDS.map((post, i) => [post, ids[i]])) };
    expect(crewBonuses(full, byId)).toMatchObject({ full: true, traits: [] });
  });

  it("renforce un trait à mesure que l'équipage compte de membres de l'affiliation", () => {
    // L'organisation porte son nom du wiki : c'est lui, et non le libellé affiché, qui décide du trait
    const crewOf = (org: string, count: number, affiliation = org) => {
      const members: Recruitable[] = Array.from({ length: count }, (_, i) => ({ id: `m${i}`, tier: 4, org, affiliation }));
      const state: PlayerState = {
        ...EMPTY_PLAYER,
        collection: Object.fromEntries(members.map((m) => [m.id, { count: 1, golden: 0 }])),
        // Du dernier poste au premier : le capitaine, qui agit sur tous les jeux, n'est pourvu qu'à dix
        crew: Object.fromEntries(members.map((m, i) => [POST_IDS[POST_IDS.length - 1 - i], m.id])),
      };
      return crewBonuses(state, new Map(members.map((m) => [m.id, m])));
    };

    expect(TRAIT_STEPS).toEqual([3, 5, 7]);
    const whitebeard = "Whitebeard Pirates";
    expect(crewOf(whitebeard, 2, "Équipage de Barbe Blanche").traits).toMatchObject([
      { org: whitebeard, affiliation: "Équipage de Barbe Blanche", count: 2, level: 0, value: 0 },
    ]);
    expect(crewOf(whitebeard, 2).berrys.all).toBeUndefined();
    const values = [3, 5, 7].map((count) => crewOf(whitebeard, count).berrys.all!);
    expect(values).toEqual([...TRAITS[whitebeard].values]);
    expect(values[0]).toBeLessThan(values[1]);
    expect(values[1]).toBeLessThan(values[2]);
    expect(crewOf(whitebeard, 9).traits[0]).toMatchObject({ level: 3, name: { fr: "Fils de Barbe Blanche", en: "Sons of Whitebeard" } });
    // Le libellé affiché, lui, suit la langue du joueur sans rien changer au trait
    expect(crewOf(whitebeard, 3, "Whitebeard Pirates").berrys.all).toBe(values[0]);

    // L'Armée révolutionnaire fait baisser les prix de la boutique : le timonier et le musicien sont pourvus à trois
    const revolution = crewOf("Revolutionary Army", 3);
    expect(revolution.traits[0]).toMatchObject({ level: 1, effect: { fr: "Réduction à la boutique", en: "Discount at the shop" } });
    expect(revolution.discount).toBeCloseTo(postStrength({ id: "m", tier: 4, org: null, affiliation: null }, undefined, "musicien") + 0.1);
  });

  it("donne à chaque trait trois paliers croissants et un libellé", () => {
    for (const [affiliation, trait] of Object.entries({ ...TRAITS, defaut: DEFAULT_TRAIT })) {
      expect(trait.values[0], affiliation).toBeGreaterThan(0);
      expect(trait.values[1], affiliation).toBeGreaterThan(trait.values[0]);
      expect(trait.values[2], affiliation).toBeGreaterThan(trait.values[1]);
      expect(trait.name.fr, affiliation).not.toBe("");
      expect(trait.name.en, affiliation).not.toBe("");
      expect(bonusLabel(trait.bonus).fr).not.toBe("");
      expect(bonusLabel(trait.bonus).en).not.toBe("");
    }
  });

  it("ignore un membre que le mode spoiler du joueur ne montre pas", () => {
    const state: PlayerState = { ...owning("inconnu"), crew: { capitaine: "inconnu" } };
    expect(crewBonuses(state, byId).berrys).toEqual({});
  });
});

describe("objectifs par jeu", () => {
  const sum = (milestones: { berrys: number }[]) => milestones.reduce((total, m) => total + m.berrys, 0);

  it("verse chaque prime une seule fois, quand l'objectif est atteint", () => {
    const first = applyGame(EMPTY_PLAYER, outcome(), pool, DAY, never);
    expect(first.reward.objectives.map((o) => o.label.fr)).toEqual([
      "Jouer une première partie",
      "Marquer la moitié des points",
      "Marquer 80 % des points",
      "Réussir un sans-faute",
    ]);
    expect(sum(first.reward.objectives)).toBe(100 + 200 + 500 + 1500);
    expect(first.state.stats["le-classement"]).toEqual({ games: 1, best: 1 });

    const second = applyGame(first.state, outcome(), pool, DAY, never);
    expect(second.reward.objectives).toEqual([]);
    expect(second.reward.total).toBe(second.reward.berrys + sum(second.reward.weekly));
  });

  it("suit chaque jeu séparément et garde la meilleure réussite", () => {
    let state = applyGame(EMPTY_PLAYER, outcome({ performance: 0.6 }), pool, "2026-10-01", never).state;
    state = applyGame(state, outcome({ performance: 0.3 }), pool, "2026-10-01", never).state;
    expect(state.stats["le-classement"]).toEqual({ games: 2, best: 0.6 });

    const other = applyGame(state, outcome({ slug: "haki", category: "savoir", performance: 0.9 }), pool, "2026-10-01", never);
    expect(other.reward.objectives.map((o) => o.label.fr)).toContain("Jouer une première partie");
    expect(other.state.stats.haki).toEqual({ games: 1, best: 0.9 });
  });

  it("récompense la régularité à la dixième partie", () => {
    let state = EMPTY_PLAYER;
    let tenth: ReturnType<typeof applyGame> | undefined;
    for (let i = 0; i < 10; i++) {
      tenth = applyGame(state, outcome({ performance: 0.1 }), pool, "2026-10-01", never);
      state = tenth.state;
    }
    expect(tenth!.reward.objectives).toEqual([{ label: { fr: "Jouer 10 parties", en: "Play 10 games" }, berrys: 500 }]);
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
    expect(challenges[2].label).toEqual({ fr: "Réussir 3 défis du jour", en: "Win 3 daily challenges" });
    expect(weeklyChallenges("2026-S41")[2].label.fr).toBe("Gagner 5 000 Berrys en jouant");
  });

  it("fait avancer un défi partie après partie et le paie une fois terminé", () => {
    const [regular] = weeklyChallenges("2026-S40");
    const game = outcome({ slug: regular.slug!, category: "savoir", performance: 0.1, difficulty: null });
    let state = EMPTY_PLAYER;
    const paid: number[] = [];
    for (let i = 0; i < 6; i++) {
      const applied = applyGame(state, game, pool, "2026-10-01", never);
      state = applied.state;
      paid.push(applied.reward.weekly.filter((w) => w.label.fr === regular.label.fr).length);
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
    const state = normalizePlayer(old as unknown as Partial<PlayerState>);
    // Les champs ajoutés depuis, y compris à l'intérieur de `day`, prennent leur valeur de départ
    expect(state).toMatchObject({ berrys: 40, stats: {}, week: { key: "" }, day: { key: "2026-10-01", earned: 40, done: [] } });
    expect(() => applyGame(state, outcome(), pool, "2026-10-02", never)).not.toThrow();
  });
});

describe("prime du joueur", () => {
  it("suit le total gagné et fixe le rang", () => {
    expect(playerBounty({ lifetimeBerrys: 12_500 })).toBe(12_500_000);
    expect(rankOf(0)).toMatchObject({ title: { fr: "Mousse", en: "Cabin Boy" }, next: { title: { fr: "Rookie" } } });
    expect(rankOf(12_500_000).title.fr).toBe("Rookie");
    expect(rankOf(499_999_999).title.fr).toBe("Supernova");
    expect(rankOf(3_000_000_000)).toEqual({ title: { fr: "Empereur", en: "Emperor" }, next: null });
  });
});
