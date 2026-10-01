import { describe, expect, it } from "vitest";
import { buildGameData, resolveGameData, type ResolvedData } from "@/games/cards";
import * as connexions from "@/games/connexions/logic";
import * as devin from "@/games/den-den-devin/logic";
import { criteriaFor } from "@/games/engine/criteria";
import * as grille from "@/games/grille/logic";
import * as route from "@/games/la-route-de-grand-line/logic";
import * as qcm from "@/games/qcm/logic";
import * as recrute from "@/games/recrute-ton-equipage/logic";
import { evaluateReport, reportSchema, type GameReport } from "@/games/report";
import { BASE_BERRYS, weeklyChallenges } from "@/lib/economy";
import { GAMES, isRewardless, LIVE_SLUGS } from "@/lib/games/catalog";

const raw = buildGameData();
const modes: ResolvedData[] = [resolveGameData(raw, "anime"), resolveGameData(raw, "manga")];
const [anime, manga] = modes;
const SEEDS = Array.from({ length: 30 }, (_, i) => 700 + i * 53);
const DIFFICULTIES = ["facile", "normal", "expert"] as const;
const run = (report: GameReport, data = anime) =>
  evaluateReport(reportSchema.parse(report), { data, animeCharacters: anime.characters, today: "2026-10-01" });

describe("critères", () => {
  it("concernent chacun au moins quatre personnages, et ont un intitulé et une question", () => {
    for (const data of modes) {
      const criteria = criteriaFor(data);
      expect(criteria.length).toBeGreaterThan(40);
      expect(new Set(criteria.map((c) => c.id)).size).toBe(criteria.length);
      for (const criterion of criteria) {
        expect(data.characters.filter(criterion.test).length, criterion.id).toBeGreaterThanOrEqual(4);
        expect(criterion.label).not.toBe("");
        expect(criterion.question.endsWith("?"), criterion.question).toBe(true);
      }
    }
  });

  it("ne proposent pas en mode anime un arc que l'anime n'a pas atteint", () => {
    const lastArc = Math.max(...anime.characters.map((c) => c.arc ?? 0));
    const arcs = criteriaFor(anime).filter((c) => c.kind === "arc").map((c) => Number(c.id.split(":")[1]));
    expect(Math.max(...arcs)).toBeLessThanOrEqual(lastArc);
  });
});

describe("Rires", () => {
  it("ne cite que des personnages connus, chacun avec un rire différent", () => {
    const ids = raw.extras.laughs.map((laugh) => laugh.characterId);
    expect(ids.filter((id) => !manga.characterById.has(id))).toEqual([]);
    expect(new Set(raw.extras.laughs.map((laugh) => laugh.text)).size).toBe(raw.extras.laughs.length);
    expect(raw.extras.laughs.length).toBeGreaterThanOrEqual(30);
  });

  it("pose dix questions à quatre personnages, la bonne réponse parmi eux", () => {
    for (const data of modes) {
      const questions = qcm.generateQcm("rires", SEEDS[0], "normal", data);
      expect(questions).toHaveLength(qcm.QCM_LENGTH);
      for (const question of questions) {
        expect(question.options).toHaveLength(4);
        expect(question.options.map((o) => o.id)).toContain(question.answerId);
      }
    }
  });
});

describe("Connexions", () => {
  it("tire quatre familles de quatre, sans personnage qui entre dans deux familles", () => {
    for (const data of modes) {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS) {
          const puzzle = connexions.generate(seed, difficulty, data);
          expect(puzzle, `${data.mode} ${difficulty} ${seed}`).not.toBeNull();
          const criteria = new Map(criteriaFor(data).map((c) => [c.id, c]));
          expect(puzzle!.groups).toHaveLength(4);
          expect(new Set(puzzle!.tiles.map((t) => t.id)).size).toBe(16);
          for (const group of puzzle!.groups) {
            expect(group.memberIds).toHaveLength(4);
            for (const id of group.memberIds) {
              const character = data.characterById.get(id)!;
              const matching = puzzle!.groups.filter((other) => criteria.get(other.id)!.test(character)).map((other) => other.id);
              expect(matching, `${character.name} dans ${group.label}`).toEqual([group.id]);
            }
          }
        }
      }
    }
  });

  it("compte les familles trouvées et s'arrête à la quatrième erreur", () => {
    const puzzle = connexions.generate(SEEDS[1], "normal", anime)!;
    const [a, b, c, d] = puzzle.groups.map((group) => group.memberIds);
    const mixed = [a[0], a[1], a[2], b[0]];
    expect(connexions.groupOf(puzzle, a)?.id).toBe(puzzle.groups[0].id);
    expect(connexions.groupOf(puzzle, mixed)).toBeNull();
    expect(connexions.oneAway(puzzle, mixed)).toBe(true);
    expect(connexions.oneAway(puzzle, [a[0], a[1], b[0], b[1]])).toBe(false);

    expect(connexions.replay(puzzle, [a, b, c, d])).toMatchObject({ found: puzzle.groups.map((g) => g.id), mistakes: 0, over: true });
    // Retrouver deux fois la même famille est une erreur ; après quatre erreurs, plus rien ne compte
    const failed = connexions.replay(puzzle, [a, a, mixed, mixed, mixed, b, c]);
    expect(failed).toMatchObject({ mistakes: 4, over: true });
    expect(failed.found).toHaveLength(1);

    const report = { slug: "connexions", seed: SEEDS[1], mode: "anime", difficulty: "normal" } as const;
    expect(run({ ...report, guesses: [a, mixed, b, c] })).toMatchObject({ score: 3, max: 4, performance: 0.75 });
    expect(reportSchema.safeParse({ ...report, guesses: [[a[0], a[1]]] }).success).toBe(false);
  });
});

describe("Grille 3×3", () => {
  it("tire une grille dont chaque case a une réponse", () => {
    for (const data of modes) {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS) {
          const grid = grille.generate(seed, difficulty, data);
          expect(grid, `${data.mode} ${difficulty} ${seed}`).not.toBeNull();
          expect(new Set([...grid!.rows, ...grid!.columns].map((c) => c.id)).size).toBe(6);
          for (let cell = 0; cell < grille.CELLS; cell++) {
            expect(grille.exampleFor(grid!, cell, data, new Set()), `case ${cell}`).not.toBeNull();
          }
        }
      }
    }
  });

  it("note les cases justes et refuse un personnage utilisé deux fois", () => {
    const seed = SEEDS[2];
    const grid = grille.generate(seed, "normal", anime)!;
    const used = new Set<string>();
    const answers = Array.from({ length: grille.CELLS }, (_, cell) => {
      const example = grille.exampleFor(grid, cell, anime, used)!;
      used.add(example.id);
      return example.id;
    });
    const report = { slug: "grille", seed, mode: "anime", difficulty: "normal" } as const;
    expect(run({ ...report, answers })).toMatchObject({ score: 9, max: 9 });
    // Le même personnage dans toutes les cases : seule la première où il convient peut compter
    expect(run({ ...report, answers: Array(9).fill(answers[0]) })?.score).toBe(1);
    expect(run({ ...report, answers: [answers[0], null, "personne"] })?.score).toBe(1);
  });
});

describe("Recrute ton équipage", () => {
  it("tire dix personnages aux primes toutes différentes", () => {
    for (const data of modes) {
      for (const difficulty of DIFFICULTIES) {
        const draw = recrute.generateDraw(SEEDS[3], difficulty, data);
        expect(draw).toHaveLength(10);
        expect(new Set(draw.map((c) => c.bounty)).size).toBe(10);
        expect([...recrute.ranksOf(draw)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      }
    }
  });

  it("paie le bon poste, puis de moins en moins à mesure qu'on s'en écarte", () => {
    expect([0, 1, 4, 5, 9].map((gap) => recrute.pointsFor(0, gap))).toEqual([5, 4, 1, 0, 0]);
    const seed = SEEDS[3];
    const draw = recrute.generateDraw(seed, "normal", anime);
    const ideal = recrute.ranksOf(draw);
    const report = { slug: "recrute-ton-equipage", seed, mode: "anime", difficulty: "normal" } as const;
    expect(run({ ...report, posts: ideal })).toMatchObject({ score: 50, max: 50 });
    expect(run({ ...report, posts: ideal.map((rank) => 9 - rank) })?.score).toBeLessThan(25);
    // Un poste donné deux fois, ou un équipage incomplet, ne rapporte rien
    expect(run({ ...report, posts: Array(10).fill(0) })?.score).toBe(0);
    expect(run({ ...report, posts: ideal.slice(0, 5) })?.score).toBe(0);
  });
});

describe("La Route de Grand Line", () => {
  it("suit les arcs dans l'ordre, sans dépasser ce que le joueur a vu", () => {
    const shorter = route.generateRoute(SEEDS[4], anime);
    const longer = route.generateRoute(SEEDS[4], manga);
    expect(shorter.length).toBeGreaterThan(15);
    expect(longer.length).toBeGreaterThanOrEqual(shorter.length);
    for (const stages of [shorter, longer]) {
      expect(stages.map((s) => s.arc)).toEqual([...stages.map((s) => s.arc)].sort((a, b) => a - b));
      expect(stages.filter((s) => s.boss).length).toBe(Math.floor(stages.length / route.BOSS_EVERY));
      for (const stage of stages) expect(stage.question.options.map((o) => o.id)).toContain(stage.question.answerId);
    }
    const lastSeen = Math.max(...anime.characters.map((c) => c.arc ?? 0));
    expect(Math.max(...shorter.map((s) => s.arc))).toBeLessThanOrEqual(lastSeen);
  });

  it("compte les vies : une par erreur, deux pour un boss raté, une rendue pour un boss battu", () => {
    const seed = SEEDS[4];
    const stages = route.generateRoute(seed, anime);
    const right = stages.map((s) => s.question.answerId);
    expect(route.replay(stages, right)).toMatchObject({ lives: 3, conquered: stages.length, over: true });
    expect(route.replay(stages, ["x", "x", "x", ...right.slice(3)])).toMatchObject({ lives: 0, conquered: 0, reached: 3, over: true });
    // Quatre îles justes, le premier boss raté : il reste une vie
    expect(route.replay(stages, [...right.slice(0, 4), "x"])).toMatchObject({ lives: 1, conquered: 4, over: false });
    // Une erreur, puis le boss battu rend la vie perdue
    expect(route.replay(stages, ["x", ...right.slice(1, 5)])).toMatchObject({ lives: 3, conquered: 4 });

    const report = { slug: "la-route-de-grand-line", seed, mode: "anime" } as const;
    expect(run({ ...report, answers: right })).toMatchObject({ score: stages.length, max: stages.length, performance: 1, difficulty: null });
    expect(run({ ...report, answers: ["x", "x", "x", ...right.slice(3)] })?.score).toBe(0);
  });
});

describe("Den Den Devin", () => {
  /** Joue une partie en répondant d'après la fiche du personnage visé. */
  function play(data: ResolvedData, targetId: string) {
    const target = data.characterById.get(targetId)!;
    const criteria = criteriaFor(data);
    const steps: devin.Step[] = [];
    const rejected = new Set<string>();
    for (let turn = 0; turn < devin.MAX_QUESTIONS + devin.MAX_GUESSES + 1; turn++) {
      const { question, best } = devin.think(data.characters, criteria, steps, rejected);
      if (question) {
        steps.push({ criterionId: question.id, reply: question.test(target) ? "yes" : "no" });
        continue;
      }
      if (!best.length) break;
      if (best[0].id === targetId) return { found: true, questions: steps.length, guesses: rejected.size + 1 };
      rejected.add(best[0].id);
    }
    return { found: false, questions: steps.length, guesses: rejected.size };
  }

  it("retrouve les personnages célèbres en vingt questions et trois propositions au plus", () => {
    for (const id of ["monkey-d-luffy", "roronoa-zoro", "nami", "crocodile", "edward-newgate", "shanks", "buggy", "kaidou"]) {
      const result = play(anime, id);
      expect(result, id).toMatchObject({ found: true });
      expect(result.questions).toBeLessThanOrEqual(devin.MAX_QUESTIONS);
      expect(result.guesses).toBeLessThanOrEqual(devin.MAX_GUESSES);
    }
  });

  it("ne pose jamais deux fois la même question et pardonne une réponse fausse", () => {
    const criteria = criteriaFor(anime);
    const luffy = anime.characterById.get("monkey-d-luffy")!;
    const steps: devin.Step[] = [];
    const rejected = new Set<string>();
    let found = false;
    for (let turn = 0; turn < 60 && !found; turn++) {
      const { question, best } = devin.think(anime.characters, criteria, steps, rejected);
      if (question) {
        // Première réponse volontairement fausse : la fiche de Luffy ne doit pas être écartée pour autant
        const truth = question.test(luffy);
        steps.push({ criterionId: question.id, reply: (steps.length === 0 ? !truth : truth) ? "yes" : "no" });
      } else if (best[0]?.id === luffy.id) found = true;
      else if (best[0]) rejected.add(best[0].id);
      else break;
    }
    expect(new Set(steps.map((s) => s.criterionId)).size).toBe(steps.length);
    expect(steps.length).toBeLessThanOrEqual(devin.MAX_QUESTIONS);
    expect(devin.disagreements(luffy, criteria, steps)).toHaveLength(1);
    // Les candidats qui collaient à toutes les réponses écartés, Luffy revient en tête
    expect(found).toBe(true);
    expect(rejected.size).toBeLessThan(devin.MAX_GUESSES);
  });
});

describe("catalogue", () => {
  it("donne un barème à chaque jeu, et rien aux jeux que le serveur ne peut pas vérifier", () => {
    for (const slug of LIVE_SLUGS) {
      if (isRewardless(slug)) expect(BASE_BERRYS[slug]).toBe(0);
      else expect(BASE_BERRYS[slug], slug).toBeGreaterThan(0);
    }
    expect(GAMES.filter((game) => game.status === "live")).toHaveLength(LIVE_SLUGS.length);
  });

  it("ne tire jamais un jeu sans récompense comme défi de la semaine", () => {
    for (let week = 1; week <= 52; week++) {
      for (const challenge of weeklyChallenges(`2027-S${String(week).padStart(2, "0")}`)) {
        if (challenge.slug) expect(isRewardless(challenge.slug)).toBe(false);
      }
    }
  });
});
