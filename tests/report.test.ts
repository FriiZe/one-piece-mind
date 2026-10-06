import { describe, expect, it } from "vitest";
import { buildGameData, resolveGameData } from "@/games/cards";
import { byDifficulty } from "@/games/engine/difficulty";
import { createRng } from "@/games/engine/rng";
import { evaluateReport, reportKey, reportSchema, type EvaluationContext, type GameReport } from "@/games/report";
import * as avis from "@/games/avis-de-recherche/logic";
import * as classement from "@/games/le-classement/logic";
import * as dle from "@/games/onepiecedle/logic";
import * as plusOuMoins from "@/games/plus-ou-moins/logic";
import * as quiAMange from "@/games/qui-a-mange-ce-fruit/logic";
import * as reveal from "@/games/revelation/logic";
import * as typeDeFruit from "@/games/type-de-fruit/logic";

const raw = buildGameData();
const data = resolveGameData(raw, "anime");
const context: EvaluationContext = { data, animeCharacters: data.characters, today: "2026-10-05" };
const SEED = 4242;
const run = (report: GameReport) => evaluateReport(reportSchema.parse(report), context);
const normal = byDifficulty(data.characters, "normal");

describe("recalcul d'une partie à partir de son compte rendu", () => {
  it("Type de fruit : compte les bonnes familles", () => {
    const quiz = typeDeFruit.generateQuiz(createRng(SEED), data.fruits);
    const answers = quiz.map((f) => typeDeFruit.familyOf(f.type)!);
    expect(run({ slug: "type-de-fruit", seed: SEED, mode: "anime", answers })).toMatchObject({ score: 10, max: 10, performance: 1 });
    expect(run({ slug: "type-de-fruit", seed: SEED, mode: "anime", answers: answers.slice(0, 4) })?.score).toBe(4);
    // Les réponses d'une autre partie ne valent pas un sans-faute
    expect(run({ slug: "type-de-fruit", seed: SEED + 1, mode: "anime", answers })!.score).toBeLessThan(10);
  });

  it("Qui a mangé ce fruit ? : compte les bonnes réponses", () => {
    const quiz = quiAMange.generateQuiz(createRng(SEED), data, normal);
    const answers = quiz.map((q, i) => (i < 7 ? q.answerId : "mauvaise-reponse"));
    expect(run({ slug: "qui-a-mange-ce-fruit", seed: SEED, mode: "anime", difficulty: "normal", answers })).toMatchObject({
      score: 7,
      max: 10,
      difficulty: "normal",
    });
  });

  it("Le classement : note chaque manche, ignore un classement truqué", () => {
    const orders = Array.from({ length: classement.ROUNDS }, (_, i) => classement.correctOrder(classement.roundAt(SEED, i, normal)));
    const report = { slug: "le-classement", seed: SEED, mode: "anime", difficulty: "normal" } as const;
    expect(run({ ...report, orders })).toMatchObject({ score: 25, max: 25 });
    // Répéter cinq fois le premier personnage ne rapporte rien
    const forged = [Array(5).fill(orders[0][0]), ...orders.slice(1)];
    expect(run({ ...report, orders: forged })?.score).toBe(20);
    expect(run({ ...report, orders: [] })?.score).toBe(0);
  });

  it("Plus ou moins : la série s'arrête à la première erreur", () => {
    const pool = plusOuMoins.bountyPool(normal);
    const answers: plusOuMoins.Answer[] = [];
    let chain = plusOuMoins.startChain(SEED, pool, "normal");
    for (let streak = 1; streak <= 6; streak++) {
      answers.push(chain.next.bounty > chain.current.bounty ? "higher" : "lower");
      chain = plusOuMoins.advanceChain(SEED, streak, pool, chain, "normal");
    }
    const wrong: plusOuMoins.Answer = chain.next.bounty > chain.current.bounty ? "lower" : "higher";
    const report = { slug: "plus-ou-moins", seed: SEED, mode: "anime", difficulty: "normal" } as const;
    expect(run({ ...report, answers })).toMatchObject({ score: 6, performance: 0.5 });
    expect(run({ ...report, answers: [...answers, wrong, "higher", "lower"] })?.score).toBe(6);
  });

  it("Avis de recherche : les indices et les erreurs coûtent des points", () => {
    const targets = avis.generatePosters(createRng(SEED), normal);
    const guess = (index: number) => ({ type: "guess", id: targets[index].id }) as const;
    const wrongId = data.characters.find((c) => c.bounty === null)!.id;
    const posters = [
      [guess(0)],
      [{ type: "hint" } as const, guess(1)],
      [{ type: "guess", id: wrongId } as const, guess(2)],
      [{ type: "pass" } as const, guess(3)],
      [],
    ];
    expect(run({ slug: "avis-de-recherche", seed: SEED, mode: "anime", difficulty: "normal", posters })).toMatchObject({
      score: 5 + 4 + 4 + 0 + 0,
      max: 25,
    });
  });

  it("Trouve-les tous : ne compte que de vrais membres, une seule fois", () => {
    const report = { slug: "trouve-les-tous", seed: SEED, mode: "anime", groupId: "chapeau-de-paille" } as const;
    expect(run({ ...report, found: ["nami", "nami", "shanks", "roronoa-zoro"] })).toMatchObject({ score: 2, max: 10 });
    expect(run({ ...report, groupId: "groupe-inconnu", found: [] })).toBeNull();
  });

  it("OnePiecedle : moins d'essais, meilleure réussite", () => {
    const target = dle.freeTarget(SEED, "normal", data.characters);
    const other = data.characters.find((c) => c.id !== target.id)!.id;
    const report = { slug: "onepiecedle", seed: SEED, mode: "anime", difficulty: "normal" } as const;
    expect(run({ ...report, guesses: [target.id] })?.performance).toBe(1);
    expect(run({ ...report, guesses: [other, other, target.id] })?.performance).toBe(0.8);
    expect(run({ ...report, guesses: [other] })?.performance).toBe(0);
    // Le nombre d'essais est gardé pour le classement du défi du jour
    expect(run({ ...report, guesses: [other, other, target.id] })?.attempts).toBe(3);
    expect(run({ ...report, guesses: [other] })?.attempts).toBeNull();
  });

  it("Défi du jour : seulement le jour même, avec le personnage commun à tous", () => {
    const target = dle.dailyTarget(data.characters, "2026-10-05");
    const report = (day: string): GameReport => ({ slug: "onepiecedle-daily", mode: "anime", day, guesses: [target.id] });
    expect(run(report("2026-10-05"))).toMatchObject({ slug: "onepiecedle", daily: true, performance: 1 });
    expect(run(report("2026-10-04"))).toBeNull();
    expect(reportKey(report("2026-10-05"))).toBe("daily:2026-10-05");
  });

  it("Révélation : paie selon le palier, refuse un déroulé impossible", () => {
    const targets = reveal.generateRounds(createRng(SEED), normal);
    const found = (index: number) => ({ type: "guess", id: targets[index].id }) as const;
    const miss = { type: "guess", id: "personne" } as const;
    const more = { type: "hint" } as const;
    const rounds = [
      [found(0)], // du premier coup : 6 points
      [miss, found(1)], // une erreur : 5 points
      [more, miss, found(2)], // une demande et une erreur : 4 points
      [{ type: "pass" } as const],
      [miss, miss, more, miss, miss, miss, found(4)], // six paliers épuisés : image perdue
      [miss, more, more, miss, more, found(5)], // trouvé au dernier palier : 1 point
    ];
    const report = { seed: SEED, mode: "anime", difficulty: "normal", rounds } as const;
    expect(run({ slug: "revelation", ...report })).toMatchObject({ score: 16, max: 48, category: "oeil" });
    expect(run({ slug: "zoom-extreme", ...report })?.score).toBe(16);
  });
});

describe("validation du compte rendu", () => {
  it("refuse ce qui n'a pas la forme attendue", () => {
    expect(reportSchema.safeParse({ slug: "type-de-fruit", seed: -1, mode: "anime", answers: [] }).success).toBe(false);
    expect(reportSchema.safeParse({ slug: "jeu-inconnu", seed: 1, mode: "anime" }).success).toBe(false);
    expect(reportSchema.safeParse({ slug: "le-classement", seed: 1, mode: "anime", difficulty: "divin", orders: [] }).success).toBe(false);
    expect(reportSchema.safeParse({ slug: "type-de-fruit", seed: 1, mode: "anime", answers: Array(11).fill("zoan") }).success).toBe(false);
    expect(reportSchema.safeParse({ slug: "type-de-fruit", seed: 1, mode: "anime", answers: [], score: 10 }).success).toBe(true);
  });
});
