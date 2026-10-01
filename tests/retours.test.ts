import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildGameData, resolveGameData } from "@/games/cards";
import * as dcc from "@/games/duo-carre-cash/logic";
import { createRng } from "@/games/engine/rng";
import { editDistance, matchesAnswer } from "@/games/engine/text";
import { parseEstimate, sliderToValue, valueToSlider } from "@/games/estimate/logic";
import { evaluateReport, reportSchema } from "@/games/report";
import {
  BOOSTER_COST,
  BOOSTER_SIZE,
  BOOSTER_SLOTS,
  boosterCost,
  buyBooster,
  DUPLICATE_VALUE,
  duplicatesValue,
  EMPTY_PLAYER,
  GOLDEN_CHANCE,
  GOLDEN_DUPLICATE_FACTOR,
  sellDuplicates,
  spareCopies,
  TAVERN_COST,
  RARITY_WEIGHTS,
  type PlayerState,
  type Recruitable,
} from "@/lib/economy";
import {
  cleanText,
  communityBerrys,
  COMMUNITY_BERRYS,
  draftProblems,
  draftToInput,
  quizInputSchema,
  REPORTS_TO_HIDE,
  scoreQuiz,
  toDccQuestions,
  type QuizDraft,
} from "@/lib/quiz/rules";
import { accountsEnabled, db } from "@/lib/server/db";
import { pendingCounts } from "@/lib/server/friends";
import { DUMMY_HASH } from "@/lib/server/password";
import { answerTrade, cancelTrade, friendCollection, proposeTrade, tradesOverview } from "@/lib/server/trades";
import { buyBoosterFor, loadState, sellDuplicatesFor } from "@/lib/server/player";
import { createQuiz, deleteQuiz, getQuiz, listQuizzes, reportQuiz, restoreQuiz, submitQuizPlay } from "@/lib/server/quizzes";

const raw = buildGameData();
const anime = resolveGameData(raw, "anime");
const manga = resolveGameData(raw, "manga");

describe("doublons de la collection", () => {
  const pool = new Map<string, Recruitable>([
    ["luffy", { id: "luffy", tier: 1, affiliation: null }],
    ["pell", { id: "pell", tier: 3, affiliation: null }],
    ["figurant", { id: "figurant", tier: 4, affiliation: null }],
  ]);
  const state: PlayerState = {
    ...EMPTY_PLAYER,
    berrys: 100,
    lifetimeBerrys: 5000,
    collection: {
      luffy: { count: 3, golden: 2 },
      pell: { count: 4, golden: 0 },
      figurant: { count: 1, golden: 0 },
      masque: { count: 5, golden: 0 },
    },
  };

  it("garde toujours un exemplaire, le doré s'il y en a un", () => {
    expect(spareCopies(undefined)).toEqual({ plain: 0, golden: 0 });
    expect(spareCopies({ count: 1, golden: 0 })).toEqual({ plain: 0, golden: 0 });
    expect(spareCopies({ count: 1, golden: 1 })).toEqual({ plain: 0, golden: 0 });
    expect(spareCopies({ count: 4, golden: 0 })).toEqual({ plain: 3, golden: 0 });
    expect(spareCopies({ count: 3, golden: 2 })).toEqual({ plain: 1, golden: 1 });
  });

  it("paie selon la rareté, davantage pour un doré", () => {
    expect(duplicatesValue(pool.get("pell")!, state.collection.pell)).toBe(3 * DUPLICATE_VALUE[3]);
    expect(duplicatesValue(pool.get("luffy")!, state.collection.luffy)).toBe(DUPLICATE_VALUE[1] * (1 + GOLDEN_DUPLICATE_FACTOR));
    expect(duplicatesValue(pool.get("figurant")!, state.collection.figurant)).toBe(0);
  });

  it("défait les doublons d'un avis sans toucher à la prime du joueur", () => {
    const sale = sellDuplicates(state, pool, "pell");
    if (typeof sale === "string") throw new Error(sale);
    expect(sale).toMatchObject({ berrys: 750, sold: 3, changed: ["pell"] });
    expect(sale.state.collection.pell).toEqual({ count: 1, golden: 0 });
    expect(sale.state.collection.luffy).toEqual(state.collection.luffy);
    expect(sale.state.berrys).toBe(850);
    expect(sale.state.lifetimeBerrys).toBe(5000);
    expect(sellDuplicates(sale.state, pool, "pell")).toBe("nothing");
    expect(sellDuplicates(state, pool, "figurant")).toBe("nothing");
    expect(sellDuplicates(state, pool, "inconnu")).toBe("nothing");
  });

  it("défait tous les doublons visibles, et laisse les avis masqués par le mode spoiler", () => {
    const sale = sellDuplicates(state, pool, null);
    if (typeof sale === "string") throw new Error(sale);
    expect(sale.sold).toBe(5);
    expect(sale.state.collection.luffy).toEqual({ count: 1, golden: 1 });
    expect(sale.state.collection.masque).toEqual({ count: 5, golden: 0 });
  });

  it("ne rend jamais la taverne rentable", () => {
    const weights = Object.values(RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    // Avec trois fois plus d'avis dorés que la normale, pour garder de la marge sur les bonus d'équipage
    const golden = GOLDEN_CHANCE * 3;
    const expected = Object.entries(RARITY_WEIGHTS).reduce(
      (sum, [tier, weight]) =>
        sum + (weight / weights) * DUPLICATE_VALUE[Number(tier)] * (1 + golden * (GOLDEN_DUPLICATE_FACTOR - 1)),
      0,
    );
    // Même avec la réduction maximale et une collection complète, un recrutement coûte plus qu'il ne rend
    expect(expected).toBeLessThan(TAVERN_COST / 2);

    const booster = BOOSTER_SLOTS.reduce((sum, slot) => {
      const total = Object.values(slot).reduce((a, b) => a + b, 0);
      return sum + Object.entries(slot).reduce((s, [tier, weight]) => s + (weight / total) * DUPLICATE_VALUE[Number(tier)], 0);
    }, 0);
    expect(booster * (1 + golden * (GOLDEN_DUPLICATE_FACTOR - 1))).toBeLessThan(BOOSTER_COST / 2);
  });
});

describe("booster de la boutique", () => {
  const pool: Recruitable[] = [
    { id: "legende", tier: 1, affiliation: null },
    { id: "rare", tier: 2, affiliation: null },
    ...Array.from({ length: 10 }, (_, i) => ({ id: `peu-commun-${i}`, tier: 3, affiliation: null })),
    ...Array.from({ length: 30 }, (_, i) => ({ id: `commun-${i}`, tier: 4, affiliation: null })),
  ];
  const tierOf = new Map(pool.map((c) => [c.id, c.tier]));
  const rich: PlayerState = { ...EMPTY_PLAYER, berrys: 10_000, lifetimeBerrys: 10_000 };

  it("coûte moins cher qu'à l'unité et se refuse sans les Berrys", () => {
    expect(boosterCost(0)).toBe(BOOSTER_COST);
    expect(BOOSTER_COST).toBeGreaterThan(TAVERN_COST);
    expect(BOOSTER_COST).toBeLessThan(TAVERN_COST * BOOSTER_SIZE);
    expect(boosterCost(0.9)).toBe(BOOSTER_COST / 2);
    expect(buyBooster({ ...EMPTY_PLAYER, berrys: BOOSTER_COST - 10 }, pool, createRng(1))).toBe("insufficient");
    expect(buyBooster(rich, [], createRng(1))).toBe("empty");
  });

  it("contient cinq avis, du plus commun au plus rare", () => {
    const fourth = new Set<number>();
    const fifth = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const bought = buyBooster(rich, pool, createRng(seed));
      if (typeof bought === "string") throw new Error(bought);
      const tiers = bought.recruits.map((recruit) => tierOf.get(recruit.characterId)!);
      expect(tiers).toHaveLength(BOOSTER_SIZE);
      // Trois cartes communes ou peu communes, une quatrième au mieux rare, une dernière rare ou légendaire
      expect(tiers.slice(0, 3).every((tier) => tier >= 3)).toBe(true);
      expect(tiers[3]).toBeGreaterThanOrEqual(2);
      expect(tiers[4]).toBeLessThanOrEqual(2);
      fourth.add(tiers[3]);
      fifth.add(tiers[4]);
      expect(bought.state.berrys).toBe(rich.berrys - BOOSTER_COST);
      // La prime du joueur ne bouge pas : il a dépensé, pas gagné
      expect(bought.state.lifetimeBerrys).toBe(rich.lifetimeBerrys);
      const counted = Object.values(bought.state.collection).reduce((sum, entry) => sum + entry.count, 0);
      expect(counted).toBe(BOOSTER_SIZE);
    }
    // La quatrième carte est parfois rare, la dernière parfois légendaire
    expect([...fourth].sort()).toEqual([2, 3, 4]);
    expect([...fifth].sort()).toEqual([1, 2]);
  });

  it("signale un doublon tiré deux fois dans le même booster", () => {
    const tiny: Recruitable[] = [{ id: "seul", tier: 2, affiliation: null }];
    const bought = buyBooster(rich, tiny, createRng(3));
    if (typeof bought === "string") throw new Error(bought);
    expect(bought.recruits.map((recruit) => recruit.duplicate)).toEqual([false, true, true, true, true]);
    expect(bought.state.collection.seul.count).toBe(BOOSTER_SIZE);
  });
});

describe("saisie d'une estimation au clavier", () => {
  it("lit les montants écrits de plusieurs façons", () => {
    expect(parseEstimate("1 500 000 000")).toBe(1_500_000_000);
    expect(parseEstimate("1.500.000")).toBe(1_500_000);
    expect(parseEstimate("320 M")).toBe(320_000_000);
    expect(parseEstimate("1,5 md")).toBe(1_500_000_000);
    expect(parseEstimate("3 milliards")).toBe(3_000_000_000);
    expect(parseEstimate("56k ฿")).toBe(56_000);
    expect(parseEstimate("1044")).toBe(1044);
    expect(parseEstimate("")).toBeNull();
    expect(parseEstimate("beaucoup")).toBeNull();
    expect(parseEstimate("-5")).toBeNull();
  });

  it("replace le curseur sur la valeur tapée", () => {
    const bounty = { min: 1_000_000, max: 6_000_000_000, scale: "log" as const };
    for (const value of [1_000_000, 30_000_000, 3_000_000_000]) {
      const back = sliderToValue(bounty, valueToSlider(bounty, value));
      expect(Math.abs(back - value) / value).toBeLessThan(0.06);
    }
    const chapter = { min: 1, max: 1185, scale: "linear" as const };
    expect(sliderToValue(chapter, valueToSlider(chapter, 700))).toBe(700);
    expect(valueToSlider(chapter, 99_999)).toBe(1);
  });
});

describe("réponses écrites sans proposition", () => {
  it("tolère la casse, les accents et une faute de frappe", () => {
    expect(editDistance("zoro", "zorro")).toBe(1);
    expect(matchesAnswer("  RORONOA zoro ", ["Roronoa Zoro"])).toBe(true);
    expect(matchesAnswer("Roronoa Zorro", ["Roronoa Zoro"])).toBe(true);
    expect(matchesAnswer("Equipage du chapeau de paile", ["Équipage du Chapeau de paille"])).toBe(true);
    expect(matchesAnswer("Sanji", ["Zoro"])).toBe(false);
    expect(matchesAnswer("", ["Zoro"])).toBe(false);
  });

  it("n'accorde aucune tolérance aux réponses courtes ni aux chiffres", () => {
    expect(matchesAnswer("Nani", ["Nami"])).toBe(false);
    expect(matchesAnswer("Gear 4", ["Gear 5"])).toBe(false);
    expect(matchesAnswer("gear 5", ["Gear 5"])).toBe(true);
    expect(matchesAnswer("Sanjy", ["Sanji"])).toBe(false);
  });

  it("ne prend pas une mauvaise réponse voisine pour une faute de frappe", () => {
    expect(matchesAnswer("West Blue", ["East Blue"])).toBe(false);
    expect(matchesAnswer("Nort Blue", ["South Blue"], ["North Blue"])).toBe(false);
    expect(matchesAnswer("Miss Sunday", ["Miss Monday"], ["Miss Sunday"])).toBe(false);
    expect(matchesAnswer("Mis Monday", ["Miss Monday"], ["Miss Sunday"])).toBe(true);
  });
});

describe("Duo, Carré ou Cash", () => {
  const SEEDS = Array.from({ length: 20 }, (_, i) => 500 + i * 41);

  it("tire dix questions à quatre propositions, avec un duo qui contient la bonne réponse", () => {
    for (const data of [anime, manga]) {
      for (const seed of SEEDS) {
        const questions = dcc.generate(seed, "normal", data);
        expect(questions).toHaveLength(dcc.DCC_LENGTH);
        expect(new Set(questions.map((q) => q.id)).size).toBe(dcc.DCC_LENGTH);
        for (const question of questions) {
          const ids = question.options.map((option) => option.id);
          expect(new Set(ids).size).toBe(4);
          expect(ids).toContain(question.answerId);
          expect(question.duoIds).toHaveLength(2);
          expect(question.duoIds).toContain(question.answerId);
          expect(ids).toEqual(expect.arrayContaining(question.duoIds));
          expect(question.accepted.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("accepte en cash le libellé exact de chaque bonne réponse", () => {
    for (const seed of SEEDS) {
      for (const question of dcc.generate(seed, "expert", manga)) {
        const label = question.options.find((option) => option.id === question.answerId)!.label;
        expect(dcc.isRight(question, { kind: "cash", value: label }), `${question.subject} → ${label}`).toBe(true);
        // Le libellé d'un leurre n'est jamais accepté à la place
        for (const option of question.options.filter((o) => o.id !== question.answerId)) {
          expect(dcc.isRight(question, { kind: "cash", value: option.label }), `${question.subject} → ${option.label}`).toBe(false);
        }
      }
    }
  });

  it("accepte le nom d'usage d'un personnage et la forme courte d'un équipage", () => {
    const luffy = manga.characterById.get("monkey-d-luffy")!;
    const forms = dcc.characterForms(luffy, manga);
    expect(forms).toContain("luffy");
    // « Monkey » désigne aussi Garp et Dragon
    expect(forms).not.toContain("monkey");
    expect(dcc.characterForms(manga.characterById.get("trafalgar-d-water-law")!, manga)).toContain("law");
    expect(dcc.labelForms("Équipage du Chapeau de paille")).toEqual(["Équipage du Chapeau de paille", "Chapeau de paille"]);
    expect(dcc.labelForms("Royaume d'Alabasta")).toContain("Alabasta");
    expect(dcc.labelForms("Marine")).toEqual(["Marine"]);
  });

  it("paie le risque : 1, 3 ou 5 points, rien pour une erreur", () => {
    const [question] = dcc.generate(SEEDS[0], "normal", anime);
    const wrong = question.options.find((option) => option.id !== question.answerId)!.id;
    expect(dcc.pointsFor(question, { kind: "duo", value: question.answerId })).toBe(1);
    expect(dcc.pointsFor(question, { kind: "carre", value: question.answerId })).toBe(3);
    expect(dcc.pointsFor(question, { kind: "cash", value: question.accepted[0] })).toBe(5);
    expect(dcc.pointsFor(question, { kind: "carre", value: wrong })).toBe(0);
    expect(dcc.pointsFor(question, { kind: "cash", value: "" })).toBe(0);
  });

  it("est rejoué par le serveur à partir du compte rendu", () => {
    const seed = SEEDS[3];
    const questions = dcc.generate(seed, "normal", anime);
    const answers = questions.map((question, index) =>
      index % 2 ? { kind: "carre" as const, value: question.answerId } : { kind: "cash" as const, value: question.accepted[0] },
    );
    const report = reportSchema.parse({ slug: "duo-carre-cash", seed, mode: "anime", difficulty: "normal", answers });
    const outcome = evaluateReport(report, { data: anime, animeCharacters: anime.characters, today: "2026-10-01" });
    expect(outcome).toMatchObject({ slug: "duo-carre-cash", score: 5 * 5 + 5 * 3, max: 50, performance: 0.8 });
    expect(reportSchema.safeParse({ ...report, answers: [{ kind: "triche", value: "x" }] }).success).toBe(false);
  });
});

const draft = (questions = 5): QuizDraft => ({
  title: "  Les   sabres de Wano ",
  description: "",
  spoiler: "anime",
  questions: Array.from({ length: questions }, (_, i) => ({
    prompt: `Question numéro ${i + 1} ?`,
    answer: `Bonne ${i}`,
    wrong: [`Fausse A${i}`, `Fausse B${i}`, `Fausse C${i}`],
    alternatives: i === 0 ? "La bonne ; bonne réponse" : "",
  })),
});

describe("règles des quiz de la communauté", () => {
  it("nettoie ce que les joueurs écrivent", () => {
    expect(cleanText("  deux   espaces\n\tet un saut ")).toBe("deux espaces et un saut");
    expect(cleanText("nom\u202epiégé")).toBe("nom piégé");
    const parsed = quizInputSchema.parse(draftToInput(draft()));
    expect(parsed.title).toBe("Les sabres de Wano");
    expect(parsed.questions[0].alternatives).toEqual(["La bonne", "bonne réponse"]);
  });

  it("dit en clair ce qui manque à un brouillon", () => {
    expect(draftProblems(draft())).toEqual([]);
    expect(draftProblems(draft(2))).toContain("Il faut au moins 5 questions.");
    const bad = draft();
    bad.title = "ab";
    bad.questions[1].wrong[0] = "bonne 1";
    bad.questions[2].answer = " ";
    const problems = draftProblems(bad);
    expect(problems).toContain("Le titre doit faire 4 à 60 caractères.");
    expect(problems).toContain("Question 2 : les quatre réponses doivent être différentes.");
    expect(problems).toContain("Question 3 : il faut une bonne réponse et trois mauvaises.");
    expect(quizInputSchema.safeParse(draftToInput(bad)).success).toBe(false);
  });

  it("mélange les propositions sans perdre la bonne réponse, et note comme le jeu", () => {
    const { questions } = quizInputSchema.parse(draftToInput(draft()));
    const played = toDccQuestions("Titre", questions, 42);
    expect(played).toHaveLength(5);
    for (const [index, question] of played.entries()) {
      expect(question.options.map((o) => o.id).sort()).toEqual([questions[index].answer, ...questions[index].wrong].sort());
      expect(question.duoIds).toEqual([questions[index].answer, questions[index].wrong[0]]);
    }
    const answers = [
      { kind: "cash" as const, value: "la bonne" },
      { kind: "carre" as const, value: "Bonne 1" },
      { kind: "duo" as const, value: "Bonne 2" },
      { kind: "carre" as const, value: "Fausse A3" },
    ];
    expect(scoreQuiz(questions, answers)).toEqual({ score: 9, max: 25 });
    expect(communityBerrys(25, 25)).toBe(COMMUNITY_BERRYS);
    expect(communityBerrys(9, 25)).toBe(50);
    expect(communityBerrys(0, 25)).toBe(0);
  });
});

describe.skipIf(!accountsEnabled)("quiz et doublons, en base", () => {
  const stamp = Date.now() % 1_000_000;
  const users: { id: string; username: string }[] = [];
  let quizId: string;

  beforeAll(async () => {
    for (const name of ["auteur", "joueur", "admin", "temoin"]) {
      const username = `${name}_${stamp}`;
      users.push(await db().user.create({ data: { username, usernameKey: username, passwordHash: DUMMY_HASH }, select: { id: true, username: true } }));
    }
    process.env.ADMIN_USERNAMES = `quelquun, ${users[2].username.toUpperCase()}`;
  });
  afterAll(async () => {
    await db().user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await db().$disconnect();
  });

  it("défait les doublons d'un compte et crédite les Berrys", async () => {
    const [, player] = users;
    const rare = anime.characters.find((c) => c.tier === 2)!;
    await db().collectionEntry.create({ data: { userId: player.id, characterId: rare.id, count: 3, golden: 1 } });

    const sold = await sellDuplicatesFor(player.id, "anime", rare.id);
    expect(sold).toMatchObject({ ok: true, sold: 2, berrys: 2 * DUPLICATE_VALUE[2] });
    const state = await loadState(player.id);
    expect(state.collection[rare.id]).toEqual({ count: 1, golden: 1 });
    expect(state.berrys).toBe(2 * DUPLICATE_VALUE[2]);
    expect(state.lifetimeBerrys).toBe(0);
    expect(await sellDuplicatesFor(player.id, "anime", null)).toEqual({ ok: false, reason: "nothing" });
    await db().user.update({ where: { id: player.id }, data: { berrys: 0 } });
  });

  it("vend un booster à un compte : cinq avis de plus, le prix en moins", async () => {
    const [, player] = users;
    expect(await buyBoosterFor(player.id, "anime")).toEqual({ ok: false, reason: "insufficient" });
    await db().user.update({ where: { id: player.id }, data: { berrys: BOOSTER_COST + 500 } });
    const before = Object.values((await loadState(player.id)).collection).reduce((sum, entry) => sum + entry.count, 0);

    const bought = await buyBoosterFor(player.id, "anime");
    if (!bought.ok) throw new Error(bought.reason);
    expect(bought.recruits).toHaveLength(BOOSTER_SIZE);
    expect(bought.cost).toBe(BOOSTER_COST);
    expect(bought.state.berrys).toBe(500);
    expect(Object.values(bought.state.collection).reduce((sum, entry) => sum + entry.count, 0)).toBe(before + BOOSTER_SIZE);
    expect(bought.recruits.every((recruit) => anime.characterById.has(recruit.characterId))).toBe(true);
    await db().user.update({ where: { id: player.id }, data: { berrys: 0 } });
  });

  it("publie un quiz valide et refuse le reste", async () => {
    const [author] = users;
    expect(await createQuiz(author, { title: "x" })).toEqual({ ok: false, error: "invalid" });
    const created = await createQuiz(author, draftToInput(draft()));
    if (!created.ok) throw new Error(created.error);
    quizId = created.id;

    const list = await listQuizzes(author, "recent");
    expect(list.quizzes.find((quiz) => quiz.id === quizId)).toMatchObject({ title: "Les sabres de Wano", questionCount: 5, plays: 0 });
    expect(list.mine.map((quiz) => quiz.id)).toContain(quizId);
    expect(list.isAdmin).toBe(false);
    expect((await listQuizzes(users[2], "top")).isAdmin).toBe(true);
  });

  it("paie la première partie d'un autre joueur, une seule fois, et jamais l'auteur", async () => {
    const [author, player] = users;
    const quiz = (await getQuiz(quizId, player))!;
    const perfect = quiz.questions.map((question) => ({ kind: "cash" as const, value: question.answer }));

    const mine = await submitQuizPlay(author, quizId, perfect);
    expect(mine).toMatchObject({ ok: true, result: { score: 25, berrys: 0, reward: "own" } });

    const half = await submitQuizPlay(player, quizId, quiz.questions.map((question) => ({ kind: "carre" as const, value: question.answer })));
    expect(half).toMatchObject({ ok: true, result: { score: 15, max: 25, berrys: 90, reward: "paid" } });
    const again = await submitQuizPlay(player, quizId, perfect);
    expect(again).toMatchObject({ ok: true, result: { score: 25, best: 25, berrys: 0, reward: "already" } });

    expect((await loadState(player.id)).berrys).toBe(90);
    expect((await loadState(author.id)).berrys).toBe(0);
    const after = (await getQuiz(quizId, player))!;
    expect(after.plays).toBe(1);
    expect(after.yourBest).toEqual({ score: 25, max: 25 });
    expect(await submitQuizPlay(player, quizId, [{ kind: "triche", value: "x" }])).toEqual({ ok: false, error: "invalid" });
  });

  it("masque un quiz signalé plusieurs fois, et laisse un administrateur le remettre en ligne", async () => {
    const [author, player, admin, witness] = users;
    expect(await reportQuiz(author, quizId, "")).toEqual({ ok: false, error: "own" });
    expect(await reportQuiz(player, quizId, "spoiler")).toEqual({ ok: true, hidden: false });
    expect(await reportQuiz(player, quizId, "encore")).toEqual({ ok: false, error: "already" });
    expect(REPORTS_TO_HIDE).toBe(3);
    expect(await reportQuiz(witness, quizId, "")).toEqual({ ok: true, hidden: false });
    expect(await reportQuiz(admin, quizId, "")).toEqual({ ok: true, hidden: true });

    // Masqué : invisible des autres joueurs, visible de son auteur et de l'administrateur
    expect(await getQuiz(quizId, player)).toBeNull();
    expect(await getQuiz(quizId, null)).toBeNull();
    expect((await getQuiz(quizId, author))?.status).toBe("hidden");
    expect((await listQuizzes(player, "recent")).quizzes.map((quiz) => quiz.id)).not.toContain(quizId);
    expect((await listQuizzes(admin, "recent")).hidden.find((quiz) => quiz.id === quizId)?.reports).toBe(3);

    expect(await restoreQuiz(player, quizId)).toEqual({ ok: false, error: "forbidden" });
    expect(await restoreQuiz(admin, quizId)).toEqual({ ok: true });
    expect((await getQuiz(quizId, player))?.status).toBe("public");
  });

  it("échange un avis contre un avis entre deux amis, d'un seul tenant", async () => {
    const [a, b, stranger] = users;
    const [given, wanted, other] = anime.characters.slice(0, 3).map((c) => c.id);
    await db().collectionEntry.deleteMany({ where: { userId: { in: [a.id, b.id] } } });
    await db().collectionEntry.createMany({
      data: [
        { userId: a.id, characterId: given, count: 2, golden: 0 },
        { userId: b.id, characterId: wanted, count: 1, golden: 1 },
      ],
    });
    await db().crewSlot.create({ data: { userId: b.id, post: "capitaine", characterId: wanted } });

    // Sans lien d'amitié, ni collection consultable ni proposition
    expect(await friendCollection(a.id, b.id)).toBeNull();
    expect(await proposeTrade(a.id, b.id, given, wanted)).toEqual({ ok: false, error: "not-friends" });
    await db().friendship.create({ data: { requesterId: a.id, addresseeId: b.id, status: "accepted" } });
    expect((await friendCollection(a.id, b.id))?.collection).toEqual({ [wanted]: { count: 1, golden: 1 } });
    expect(await friendCollection(stranger.id, b.id)).toBeNull();

    expect(await proposeTrade(a.id, b.id, given, given)).toEqual({ ok: false, error: "same" });
    expect(await proposeTrade(a.id, b.id, other, wanted)).toEqual({ ok: false, error: "not-owned" });
    expect(await proposeTrade(a.id, b.id, given, other)).toEqual({ ok: false, error: "friend-not-owned" });
    expect(await proposeTrade(a.id, b.id, given, wanted)).toEqual({ ok: true });
    expect(await proposeTrade(a.id, b.id, given, wanted)).toEqual({ ok: false, error: "already" });

    const [trade] = (await tradesOverview(b.id)).incoming;
    expect(trade).toMatchObject({ friend: a.username, offeredId: given, requestedId: wanted });
    expect((await tradesOverview(a.id)).outgoing).toHaveLength(1);
    expect((await pendingCounts(b.id, false)).trades).toBe(1);
    // Seul le destinataire répond ; rien n'a bougé d'ici là
    expect(await answerTrade(a.id, trade.id, true)).toEqual({ ok: false, error: "not-found" });
    expect((await loadState(a.id)).collection).toEqual({ [given]: { count: 2, golden: 0 } });

    expect(await answerTrade(b.id, trade.id, true)).toEqual({ ok: true });
    expect((await loadState(a.id)).collection).toEqual({ [given]: { count: 1, golden: 0 }, [wanted]: { count: 1, golden: 1 } });
    const after = await loadState(b.id);
    expect(after.collection).toEqual({ [given]: { count: 1, golden: 0 } });
    // Son seul exemplaire est parti : l'avis quitte aussi son équipage
    expect(after.crew).toEqual({});
    expect((await pendingCounts(b.id, false)).trades).toBe(0);
    expect(await answerTrade(b.id, trade.id, true)).toEqual({ ok: false, error: "not-found" });
  });

  it("annule une proposition dont un avis n'est plus là, et laisse retirer la sienne", async () => {
    const [a, b] = users;
    const [given, wanted] = anime.characters.slice(0, 2).map((c) => c.id);
    // Après l'échange précédent : a possède `given` et `wanted`, b possède `given`
    expect(await proposeTrade(b.id, a.id, given, wanted)).toEqual({ ok: true });
    const [trade] = (await tradesOverview(a.id)).incoming;
    await db().collectionEntry.deleteMany({ where: { userId: b.id, characterId: given } });
    expect(await answerTrade(a.id, trade.id, true)).toEqual({ ok: false, error: "gone" });
    expect((await loadState(a.id)).collection[wanted]).toEqual({ count: 1, golden: 1 });
    expect((await tradesOverview(a.id)).incoming).toEqual([]);

    expect(await proposeTrade(a.id, b.id, wanted, given)).toEqual({ ok: false, error: "friend-not-owned" });
    await db().collectionEntry.create({ data: { userId: b.id, characterId: given, count: 1, golden: 0 } });
    expect(await proposeTrade(a.id, b.id, wanted, given)).toEqual({ ok: true });
    const [mine] = (await tradesOverview(a.id)).outgoing;
    expect(await cancelTrade(b.id, mine.id)).toEqual({ ok: false, error: "not-found" });
    expect(await cancelTrade(a.id, mine.id)).toEqual({ ok: true });
    expect((await tradesOverview(b.id)).incoming).toEqual([]);
  });

  it("ne laisse supprimer un quiz qu'à son auteur ou à un administrateur", async () => {
    const [author, player, admin] = users;
    expect(await deleteQuiz(player, quizId)).toEqual({ ok: false, error: "forbidden" });
    const second = await createQuiz(author, draftToInput(draft(6)));
    if (!second.ok) throw new Error(second.error);
    expect(await deleteQuiz(admin, second.id)).toEqual({ ok: true });
    expect(await deleteQuiz(author, quizId)).toEqual({ ok: true });
    expect(await getQuiz(quizId, author)).toBeNull();
    expect(await deleteQuiz(author, quizId)).toEqual({ ok: false, error: "not-found" });
  });
});
