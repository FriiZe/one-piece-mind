import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildGameData, resolveGameData, type PlayCharacter } from "@/games/cards";
import { dailyKey, dailyNumber, isNextDay } from "@/games/engine/daily";
import { byDifficulty } from "@/games/engine/difficulty";
import { createRng, sample, seedFromString, shuffle } from "@/games/engine/rng";
import { nameForms, normalizeText, searchByName } from "@/games/engine/text";
import * as avis from "@/games/avis-de-recherche/logic";
import * as classement from "@/games/le-classement/logic";
import * as dle from "@/games/onepiecedle/logic";
import * as plusOuMoins from "@/games/plus-ou-moins/logic";
import * as quiAMange from "@/games/qui-a-mange-ce-fruit/logic";
import * as reveal from "@/games/revelation/logic";
import * as trouve from "@/games/trouve-les-tous/logic";
import * as typeDeFruit from "@/games/type-de-fruit/logic";
import { MAIN_AFFILIATION_OVERRIDES } from "@/lib/data/labels";
import { characterById as datasetCharacterById, images } from "@/lib/data";
import { imageManifestSchema } from "@/lib/data/schema";

const raw = buildGameData();
const manga = resolveGameData(raw, "manga");
const anime = resolveGameData(raw, "anime");
const get = (id: string) => manga.characterById.get(id)!;

describe("moteur", () => {
  it("rejoue la même partie à partir de la même graine", () => {
    const draw = (seed: number) => shuffle(createRng(seed), [1, 2, 3, 4, 5, 6, 7, 8]);
    expect(draw(42)).toEqual(draw(42));
    expect(draw(42)).not.toEqual(draw(43));
    expect(sample(createRng(1), [1, 2, 3], 5)).toHaveLength(3);
    expect(seedFromString("onepiecedle")).toBe(seedFromString("onepiecedle"));
  });

  it("change de jour à minuit, heure de Paris", () => {
    expect(dailyKey(new Date("2026-10-01T21:59:00Z"))).toBe("2026-10-01");
    expect(dailyKey(new Date("2026-10-01T22:01:00Z"))).toBe("2026-10-02");
    expect(dailyNumber("2026-10-01")).toBe(1);
    expect(dailyNumber("2026-10-31")).toBe(31);
    expect(isNextDay("2026-10-31", "2026-11-01")).toBe(true);
    expect(isNextDay("2026-10-30", "2026-11-01")).toBe(false);
  });

  it("compare les saisies sans tenir compte des accents ni de la ponctuation", () => {
    expect(normalizeText("  Kin'émon ")).toBe("kin emon");
    expect(normalizeText("Monkey D. Luffy")).toBe("monkey d luffy");
    expect(nameForms(get("buggy"))).toEqual(expect.arrayContaining(["baggy", "buggy"]));
  });

  it("retrouve un personnage par son nom, son prénom ou un autre nom d'usage", () => {
    const names = (query: string) => searchByName(manga.characters, query).map((c) => c.id);
    expect(names("luffy")[0]).toBe("monkey-d-luffy");
    expect(names("zoro")).toContain("roronoa-zoro");
    expect(names("katakuri")).toContain("charlotte-katakuri");
    expect(names("barbe noire")).toContain("marshall-d-teach");
    expect(names("")).toEqual([]);
  });
});

describe("données des jeux", () => {
  it("ne propose en mode anime que des personnages et des fruits déjà adaptés", () => {
    for (const c of anime.characters) expect(c.debut).toBeLessThanOrEqual(raw.animeCutoffChapter);
    for (const f of anime.fruits) expect(f.debut).toBeLessThanOrEqual(raw.animeCutoffChapter);
    expect(anime.characters.length).toBeLessThanOrEqual(manga.characters.length);
  });

  it("applique les valeurs propres au mode anime", () => {
    // L'origine de Shanks n'est révélée qu'au chapitre 1158
    expect(get("shanks").sea).toBe("west-blue");
    expect(anime.characterById.get("shanks")!.sea).toBeNull();
    expect(anime.characterById.get("shanks")).not.toHaveProperty("anime");
  });

  it("n'attribue un fruit qu'à un personnage dont le fruit est jouable", () => {
    for (const data of [manga, anime]) {
      for (const c of data.characters) if (c.fruitId) expect(data.fruitById.has(c.fruitId), c.id).toBe(true);
    }
  });

  it("donne une affiliation française cohérente aux personnages majeurs", () => {
    expect(get("monkey-d-luffy").affiliation).toBe("Équipage du Chapeau de paille");
    expect(get("monkey-d-garp").affiliation).toBe("Marine");
    expect(get("rob-lucci").affiliation).toBe("Cipher Pol");
    expect(get("portgas-d-ace").affiliation).toBe("Équipage de Barbe Blanche");
    for (const id of Object.keys(MAIN_AFFILIATION_OVERRIDES)) expect(datasetCharacterById.has(id), id).toBe(true);
  });

  it("garde assez de personnages à chaque niveau de difficulté", () => {
    expect(byDifficulty(anime.characters, "facile").length).toBeGreaterThanOrEqual(60);
    expect(byDifficulty(anime.characters, "normal").length).toBeGreaterThan(byDifficulty(anime.characters, "facile").length);
    expect(byDifficulty(anime.characters, "expert")).toHaveLength(anime.characters.length);
  });
});

describe("OnePiecedle", () => {
  const cell = (cells: dle.Cell[], key: dle.ColumnKey) => cells.find((c) => c.key === key)!;

  it("donne toutes les cases justes quand on propose le bon personnage", () => {
    const luffy = get("monkey-d-luffy");
    expect(dle.compare(luffy, luffy, manga).every((c) => c.verdict === "exact")).toBe(true);
  });

  it("oriente le joueur sur les valeurs chiffrées", () => {
    const cells = dle.compare(get("nami"), get("monkey-d-luffy"), manga);
    expect(cell(cells, "gender").verdict).toBe("wrong");
    expect(cell(cells, "affiliation").verdict).toBe("exact");
    expect(cell(cells, "sea").verdict).toBe("exact");
    expect(cell(cells, "bounty")).toMatchObject({ verdict: "wrong", direction: "up" });
    expect(cell(cells, "arc")).toMatchObject({ verdict: "wrong", direction: "down" });
    expect(cell(cells, "haki").verdict).toBe("wrong");
    expect(cell(cells, "fruit")).toMatchObject({ label: "Aucun", verdict: "wrong" });
  });

  it("signale un haki ou un type de fruit partiellement justes", () => {
    // Zoro maîtrise les trois hakis, Sanji deux
    expect(cell(dle.compare(get("sanji"), get("roronoa-zoro"), manga), "haki").verdict).toBe("partial");
    // Marco (Zoan mythique) et Lucci (Zoan) : même famille de fruit
    expect(cell(dle.compare(get("rob-lucci"), get("polo-marco"), manga), "fruit").verdict).toBe("partial");
  });

  it("tire le même personnage du jour pour tout le monde, connu des deux modes", () => {
    const target = dle.dailyTarget(anime.characters, "2026-10-05");
    expect(dle.dailyTarget(anime.characters, "2026-10-05").id).toBe(target.id);
    expect(target.tier).toBeLessThanOrEqual(2);
    expect(manga.characterById.has(target.id)).toBe(true);
  });

  it("ne répète pas un personnage tant que la liste n'est pas épuisée", () => {
    const days = Array.from({ length: 60 }, (_, i) => `2026-${i < 31 ? "10" : "11"}-${String((i % 31) + 1).padStart(2, "0")}`);
    const ids = days.slice(0, 60).map((day) => dle.dailyTarget(anime.characters, day).id);
    expect(new Set(ids).size).toBe(new Set(days).size);
  });

  it("résume une partie en grille d'emojis", () => {
    const rows = [dle.compare(get("nami"), get("monkey-d-luffy"), manga), dle.compare(get("monkey-d-luffy"), get("monkey-d-luffy"), manga)];
    const [first, last] = dle.shareGrid(rows).split("\n");
    expect(first).toContain("⬆️");
    expect(last).toBe("🟩".repeat(dle.COLUMNS.length));
  });
});

describe("Plus ou moins", () => {
  const pool = plusOuMoins.bountyPool(manga.characters);

  it("compare deux primes", () => {
    const luffy = pool.find((c) => c.id === "monkey-d-luffy")!;
    const nami = pool.find((c) => c.id === "nami")!;
    expect(plusOuMoins.isCorrect(nami, luffy, "higher")).toBe(true);
    expect(plusOuMoins.isCorrect(nami, luffy, "lower")).toBe(false);
    expect(plusOuMoins.isCorrect(luffy, nami, "lower")).toBe(true);
  });

  it("ne propose jamais deux primes égales ni un personnage vu récemment", () => {
    const rng = createRng(7);
    let current = pool[0];
    const recent: string[] = [current.id];
    for (let i = 0; i < 200; i++) {
      const next = plusOuMoins.nextOpponent(rng, pool, current, recent.slice(-10));
      expect(next.bounty).not.toBe(current.bounty);
      expect(recent.slice(-10)).not.toContain(next.id);
      recent.push(next.id);
      current = next;
    }
  });
});

describe("Le classement", () => {
  it("tire cinq personnages aux valeurs distinctes et note leur rang", () => {
    for (let seed = 0; seed < 50; seed++) {
      const round = classement.generateRound(createRng(seed), byDifficulty(anime.characters, "normal"));
      const values = round.items.map((c) => c[round.criterion]);
      expect(round.items).toHaveLength(classement.ROUND_SIZE);
      expect(values.every((v) => v !== null)).toBe(true);
      expect(new Set(values).size).toBe(classement.ROUND_SIZE);

      const expected = classement.correctOrder(round);
      expect(classement.scoreRound(round, expected)).toBe(classement.ROUND_SIZE);
      expect(classement.scoreRound(round, [...expected].reverse())).toBe(1);
    }
  });
});

describe("Type de fruit", () => {
  it("range chaque fruit dans sa famille", () => {
    expect(typeDeFruit.familyOf("zoan-mythical")).toBe("zoan");
    expect(typeDeFruit.familyOf("logia")).toBe("logia");
    expect(typeDeFruit.familyOf("smile")).toBeNull();
  });

  it("tire des fruits distincts, toutes familles confondues", () => {
    const quiz = typeDeFruit.generateQuiz(createRng(3), manga.fruits, 10);
    expect(new Set(quiz.map((f) => f.id)).size).toBe(10);
    expect(quiz.every((f) => typeDeFruit.familyOf(f.type) !== null)).toBe(true);
    expect(new Set(quiz.map((f) => typeDeFruit.familyOf(f.type))).size).toBeGreaterThan(1);
  });
});

describe("Qui a mangé ce fruit ?", () => {
  it("propose quatre réponses dont une seule bonne", () => {
    for (let seed = 0; seed < 30; seed++) {
      const quiz = quiAMange.generateQuiz(createRng(seed), anime, byDifficulty(anime.characters, "normal"));
      expect(quiz).toHaveLength(10);
      for (const q of quiz) {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options.map((o) => o.id)).size).toBe(4);
        if (q.kind === "fruit-to-user") {
          const eaters = q.options.filter((o) => o.fruitId === q.fruit.id);
          expect(eaters.map((o) => o.id)).toEqual([q.answerId]);
        } else {
          expect(q.character.fruitId).toBe(q.answerId);
          expect(q.options.filter((o) => o.id === q.answerId)).toHaveLength(1);
        }
        expect(quiAMange.isCorrect(q, q.answerId)).toBe(true);
      }
    }
  });
});

describe("Trouve-les tous", () => {
  const group = (id: string) => manga.groups.find((g) => g.id === id)!;
  const formsOf = (id: string) => trouve.acceptedForms(trouve.membersOf(group(id), manga.characterById));

  it("accepte un prénom quand il ne désigne qu'un membre", () => {
    const forms = formsOf("chapeau-de-paille");
    expect(trouve.matchMember("Zoro", forms, new Set())).toBe("roronoa-zoro");
    expect(trouve.matchMember("monkey d. luffy", forms, new Set())).toBe("monkey-d-luffy");
    expect(trouve.matchMember("Chopper", forms, new Set())).toBe("tony-tony-chopper");
    expect(trouve.matchMember("Zoro", forms, new Set(["roronoa-zoro"]))).toBeNull();
    expect(trouve.matchMember("Shanks", forms, new Set())).toBeNull();
  });

  it("refuse un nom de famille partagé par plusieurs membres", () => {
    const forms = formsOf("vinsmoke");
    expect(trouve.matchMember("Vinsmoke", forms, new Set())).toBeNull();
    expect(trouve.matchMember("Reiju", forms, new Set())).toBe("vinsmoke-reiju");
  });

  it("permet de trouver chaque membre de chaque groupe par son nom affiché", () => {
    for (const g of manga.groups) {
      const members = trouve.membersOf(g, manga.characterById);
      const forms = trouve.acceptedForms(members);
      for (const m of members) expect(trouve.matchMember(m.name, forms, new Set()), `${g.id} / ${m.name}`).toBe(m.id);
    }
  });

  it("ne propose un groupe que si le joueur en connaît tous les membres", () => {
    expect(manga.groups).toHaveLength(raw.groups.length);
    for (const g of anime.groups) {
      expect(g.since).toBeLessThanOrEqual(raw.animeCutoffChapter);
      expect(g.memberIds.every((id) => anime.characterById.has(id))).toBe(true);
    }
    expect(trouve.timeLimit(3)).toBe(60);
    expect(trouve.timeLimit(16)).toBe(192);
  });
});

describe("Avis de recherche", () => {
  it("donne moins de points à mesure que les indices sont dévoilés", () => {
    expect([0, 1, 2, 3, 4, 9].map(avis.pointsFor)).toEqual([5, 4, 3, 2, 1, 1]);
  });

  it("accepte un personnage que rien d'affiché ne distingue de la bonne réponse", () => {
    const luffy = get("monkey-d-luffy");
    const law = get("trafalgar-d-water-law");
    const nami = get("nami");
    expect(luffy.bounty).toBe(law.bounty);
    // Sans indice, seule la prime est affichée : Law est une réponse valable
    expect(avis.isAccepted(law, luffy, 0, manga)).toBe(true);
    // L'affiliation dévoilée les départage
    expect(avis.isAccepted(law, luffy, 1, manga)).toBe(false);
    expect(avis.isAccepted(luffy, luffy, 4, manga)).toBe(true);
    expect(avis.isAccepted(nami, luffy, 0, manga)).toBe(false);
  });

  it("termine toujours par l'initiale, sans jamais afficher le nom", () => {
    const hints = avis.hintsFor(get("roronoa-zoro"), manga);
    expect(hints.at(-1)).toEqual({ key: "initial", title: "Initiale", value: "R… (11 lettres)" });
    expect(hints.some((h) => h.value.includes("Zoro"))).toBe(false);
  });

  it("ne tire que des personnages primés, tous différents", () => {
    const posters = avis.generatePosters(createRng(11), byDifficulty(anime.characters, "facile"));
    expect(posters).toHaveLength(5);
    expect(new Set(posters.map((p) => p.id)).size).toBe(5);
    expect(posters.every((p: PlayCharacter) => p.bounty !== null)).toBe(true);
  });
});

describe("Révélation et Zoom extrême", () => {
  it("ne tire que des personnages qui ont un portrait, tous différents", () => {
    const rounds = reveal.generateRounds(createRng(5), byDifficulty(anime.characters, "facile"));
    expect(rounds).toHaveLength(reveal.ROUNDS);
    expect(new Set(rounds.map((c) => c.id)).size).toBe(reveal.ROUNDS);
    expect(rounds.every((c) => typeof c.img === "string")).toBe(true);
  });

  it("donne moins de points à chaque palier", () => {
    expect(Array.from({ length: reveal.STEPS }, (_, step) => reveal.pointsFor(step))).toEqual([6, 5, 4, 3, 2, 1]);
    expect(reveal.PIXEL_COLUMNS).toHaveLength(reveal.STEPS);
    expect(reveal.ZOOM_FACTORS).toHaveLength(reveal.STEPS);
    expect([...reveal.PIXEL_COLUMNS]).toEqual([...reveal.PIXEL_COLUMNS].sort((a, b) => a - b));
    expect([...reveal.ZOOM_FACTORS]).toEqual([...reveal.ZOOM_FACTORS].sort((a, b) => b - a));
  });

  it("garde le cadre du zoom à l'intérieur de l'image", () => {
    for (let seed = 0; seed < 200; seed++) {
      const focus = reveal.zoomFocus(createRng(seed));
      for (const factor of reveal.ZOOM_FACTORS) {
        const view = reveal.zoomWindow(230, 345, focus, factor);
        expect(view.x).toBeGreaterThanOrEqual(0);
        expect(view.y).toBeGreaterThanOrEqual(0);
        expect(view.x + view.width).toBeLessThanOrEqual(230 + 1e-9);
        expect(view.y + view.height).toBeLessThanOrEqual(345 + 1e-9);
      }
    }
    // Un point visé dans un coin est ramené dans le cadre
    expect(reveal.zoomWindow(200, 300, { x: 0, y: 1 }, 2)).toEqual({ x: 0, y: 150, width: 100, height: 150 });
  });

  it("a assez de portraits à chaque niveau de difficulté", () => {
    expect(reveal.pictured(byDifficulty(anime.characters, "facile")).length).toBeGreaterThanOrEqual(60);
    expect(reveal.pictured(anime.characters).length).toBeGreaterThanOrEqual(400);
  });
});

describe("images", () => {
  it("rattache chaque portrait à un personnage du manga et à un fichier présent", () => {
    expect(imageManifestSchema.safeParse(images).error?.issues ?? []).toEqual([]);
    const files = new Set<string>();
    for (const [id, entry] of Object.entries(images.portraits)) {
      expect(datasetCharacterById.get(id)?.canon, id).toBe(true);
      expect(existsSync(path.resolve(import.meta.dirname, `../public/images/portraits/${entry.file}.webp`)), id).toBe(true);
      // Le nom du fichier ne doit pas trahir le personnage
      expect(entry.file).not.toContain(id.split("-")[0]);
      files.add(entry.file);
    }
    expect(files.size).toBe(Object.keys(images.portraits).length);
  });

  it("ne laisse aucun fichier orphelin dans le dossier des portraits", () => {
    const known = new Set(Object.values(images.portraits).map((entry) => `${entry.file}.webp`));
    const present = readdirSync(path.resolve(import.meta.dirname, "../public/images/portraits"));
    expect(present.filter((file) => !known.has(file))).toEqual([]);
  });
});

describe("catalogue", () => {
  it("donne à chaque jeu en ligne une page complète", async () => {
    const { GAMES, LIVE_SLUGS } = await import("@/lib/games/catalog");
    const { GAME_CONTENT } = await import("@/games/content");
    expect(GAMES.filter((g) => g.status === "live").map((g) => g.slug).sort()).toEqual([...LIVE_SLUGS].sort());
    expect(new Set(GAMES.map((g) => g.slug)).size).toBe(GAMES.length);
    for (const slug of LIVE_SLUGS) {
      const content = GAME_CONTENT[slug];
      expect(content.metaTitle.length, slug).toBeLessThanOrEqual(70);
      expect(content.metaDescription.length, slug).toBeGreaterThanOrEqual(110);
      expect(content.metaDescription.length, slug).toBeLessThanOrEqual(200);
      expect(content.howTo.length).toBeGreaterThanOrEqual(3);
      expect(content.faq.length).toBeGreaterThanOrEqual(3);
    }
  });
});
