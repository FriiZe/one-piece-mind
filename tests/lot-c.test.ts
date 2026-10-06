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
import { GAMES, getGame, isRewardless, LIVE_SLUGS, PAUSED_SLUGS } from "@/lib/games/catalog";
import { validGames } from "@/lib/multi/rules";

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

  it("comptent tous les anciens membres d'une organisation dissoute", () => {
    // Le wiki marque « ancienne » l'alliance de Wano pour la plupart de ses membres : Kinémon en fait partie quand même
    const alliance = criteriaFor(manga).find((c) => c.id === "affiliation:Alliance des ninjas, pirates, minks et samouraïs")!;
    const members = manga.characters.filter(alliance.test).map((c) => c.id);
    expect(members).toEqual(expect.arrayContaining(["kin-emon", "monkey-d-luffy", "trafalgar-d-water-law", "eustass-kid", "nekomamushi"]));
    expect(members.length).toBeGreaterThanOrEqual(50);
    expect(manga.characterById.get("kin-emon")!.haki).toContain("armament");
    const baroque = criteriaFor(manga).find((c) => c.id === "affiliation:Baroque Works")!;
    expect(manga.characters.filter(baroque.test).map((c) => c.id)).toEqual(expect.arrayContaining(["crocodile", "nico-robin", "nefertari-vivi"]));
  });

  it("ne proposent pas en mode anime un arc que l'anime n'a pas atteint", () => {
    const lastArc = Math.max(...anime.characters.map((c) => c.arc ?? 0));
    const arcs = criteriaFor(anime).filter((c) => c.kind === "arc").map((c) => Number(c.id.split(":")[1]));
    expect(Math.max(...arcs)).toBeLessThanOrEqual(lastArc);
  });
});

describe("critères et groupes ajoutés", () => {
  it("proposent de nouveaux paliers, les hakis un à un et l'initiale du nom", () => {
    const ids = new Set(criteriaFor(manga).map((criterion) => criterion.id));
    for (const id of ["fruit:zoan-mythical", "fruit:zoan-ancient", "fruit:none", "haki:observation", "haki:armament", "bounty:500m", "size:5m", "age:70", "age:18", "initial:M"]) {
      expect(ids, id).toContain(id);
    }
    const initial = criteriaFor(manga).find((criterion) => criterion.id === "initial:M")!;
    expect(initial.test(manga.characterById.get("monkey-d-luffy")!)).toBe(true);
    expect(initial.test(manga.characterById.get("nami")!)).toBe(false);
  });

  it("comptent un personnage dans chacune de ses organisations actuelles", () => {
    const criteria = new Map(criteriaFor(manga).map((criterion) => [criterion.id, criterion]));
    const katakuri = manga.characterById.get("charlotte-katakuri")!;
    expect(criteria.get("affiliation:Famille Charlotte")!.test(katakuri)).toBe(true);
    expect(criteria.get("affiliation:Équipage de Big Mom")!.test(katakuri)).toBe(true);
    // Une organisation quittée ne compte plus, sauf si elle n'existe plus elle-même (voir DISSOLVED_ORGANIZATIONS)
    expect(criteria.get("affiliation:Marine")!.test(manga.characterById.get("kuzan")!)).toBe(false);
    expect(criteria.get("affiliation:Baroque Works")!.test(manga.characterById.get("nico-robin")!)).toBe(true);
  });

  it("Den Den Devin ne demande jamais l'initiale", () => {
    const criteria = criteriaFor(anime).filter(devin.askable);
    expect(criteria.some((criterion) => criterion.kind === "initial")).toBe(false);
    expect(criteria.length).toBeGreaterThan(40);
  });

  it("comptent sept groupes de plus, tous jouables en mode manga", () => {
    expect(raw.groups).toHaveLength(22);
    for (const id of ["pretres-d-enel", "contremaitres-galley-la", "mysterieux-thriller-bark", "officiers-hommes-poissons", "grande-flotte", "commandants-revolutionnaires", "satellites-vegapunk"]) {
      const group = manga.groups.find((g) => g.id === id);
      expect(group, id).toBeDefined();
      expect(group!.memberIds.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("Rires, jeu abandonné", () => {
  it("n'existe plus : ni au catalogue, ni dans les récompenses, ni dans les comptes rendus", () => {
    expect(getGame("rires")).toBeUndefined();
    expect(GAMES.some((game) => game.slug === "rires")).toBe(false);
    expect(LIVE_SLUGS as readonly string[]).not.toContain("rires");
    expect(PAUSED_SLUGS).toEqual([]);
    expect(Object.keys(BASE_BERRYS)).not.toContain("rires");
    expect(reportSchema.safeParse({ slug: "rires", seed: SEEDS[0], mode: "anime", difficulty: "normal", answers: [] }).success).toBe(false);
  });

  it("un salon qui le cite encore tire ses questions dans les autres quiz", () => {
    expect(validGames(["surnoms", "rires"])).toBeNull();
    const stale = ["rires"] as unknown as qcm.MixSlug[];
    expect(qcm.generateMixed(SEEDS[0], stale, 10, "normal", anime)).toHaveLength(10);
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
  it("tire une grille qu'on peut remplir en entier sans réutiliser un personnage", () => {
    for (const data of modes) {
      for (const difficulty of DIFFICULTIES) {
        for (let seed = 1; seed <= 150; seed++) {
          const grid = grille.generate(seed, difficulty, data);
          if (grid) expect(grille.solvable(grid, data.characters), `${data.mode} ${difficulty} ${seed}`).toBe(true);
        }
      }
    }
    // Deux cases qui n'ont qu'un même personnage pour réponse : la grille ne se remplit pas
    type Row = grille.Grid["rows"][number];
    const [solo] = anime.characters;
    const criterion = (id: string, test: Row["test"]): Row => ({ id, kind: "initial", label: id, question: `${id} ?`, test });
    const only = criterion("seul", (c) => c.id === solo.id);
    const any = criterion("tous", () => true);
    expect(grille.solvable({ rows: [only, any, any], columns: [any, any, any] }, anime.characters)).toBe(false);
    expect(grille.solvable({ rows: [any, any, any], columns: [any, any, any] }, anime.characters)).toBe(true);
  }, 30_000);

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
