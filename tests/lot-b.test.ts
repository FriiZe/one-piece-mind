import { describe, expect, it } from "vitest";
import { buildGameData, resolveGameData, type ResolvedData } from "@/games/cards";
import * as anagramme from "@/games/anagramme/logic";
import * as chronologie from "@/games/chronologie/logic";
import * as clues from "@/games/clues/logic";
import { createRng } from "@/games/engine/rng";
import { normalizeText } from "@/games/engine/text";
import * as estimate from "@/games/estimate/logic";
import * as memo from "@/games/memo/logic";
import * as qcm from "@/games/qcm/logic";
import { evaluateReport, reportSchema, type GameReport } from "@/games/report";
import * as wordle from "@/games/wordle/logic";

const raw = buildGameData();
const modes: ResolvedData[] = [resolveGameData(raw, "anime"), resolveGameData(raw, "manga")];
const anime = modes[0];
const SEEDS = Array.from({ length: 25 }, (_, i) => 1000 + i * 37);
const DIFFICULTIES = ["facile", "normal", "expert"] as const;

describe("contenus rédigés", () => {
  it("ne citent que des personnages connus du jeu", () => {
    const manga = modes[1];
    const referenced = [
      ...raw.extras.epithets,
      ...raw.extras.techniques,
      ...raw.extras.weapons,
      ...raw.extras.emojis,
    ].map((item) => item.characterId);
    expect(referenced.filter((id) => !manga.characterById.has(id))).toEqual([]);
  });

  it("ne donnent pas le nom du personnage dans son surnom", () => {
    for (const { characterId, text } of raw.extras.epithets) {
      const name = modes[1].characterById.get(characterId)!.name;
      for (const word of normalizeText(name).split(" ").filter((w) => w.length > 2)) {
        expect(normalizeText(text).split(" "), `${characterId} : ${text}`).not.toContain(word);
      }
    }
  });

  it("n'ont pas de doublon", () => {
    for (const names of [raw.extras.techniques.map((t) => t.name), raw.extras.weapons.map((w) => w.name), raw.extras.ships.map((s) => s.name)]) {
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe("quiz à choix", () => {
  it.each(qcm.QCM_SLUGS)("%s : dix questions jouables, quels que soient le tirage, le mode et la difficulté", (slug) => {
    for (const data of modes) {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS.slice(0, 8)) {
          const questions = qcm.generateQcm(slug, seed, difficulty, data);
          expect(questions, `${slug} ${data.mode} ${difficulty} ${seed}`).toHaveLength(qcm.QCM_LENGTH);
          expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
          for (const q of questions) {
            const ids = q.options.map((o) => o.id);
            const labels = q.options.map((o) => o.label);
            expect(q.options.length, q.id).toBeGreaterThanOrEqual(2);
            expect(new Set(ids).size, `${slug} ${q.id} : ${ids}`).toBe(ids.length);
            expect(new Set(labels).size, `${slug} ${q.id} : ${labels}`).toBe(labels.length);
            expect(ids.filter((id) => id === q.answerId), `${slug} ${q.id}`).toHaveLength(1);
            expect(q.subject.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("rejoue la même partie à partir de la même graine et la note", () => {
    for (const slug of qcm.QCM_SLUGS) {
      const questions = qcm.generateQcm(slug, 77, "normal", anime);
      expect(qcm.generateQcm(slug, 77, "normal", anime)).toEqual(questions);
      const answers = questions.map((q) => q.answerId);
      expect(qcm.evaluate(slug, 77, "normal", answers, anime)).toEqual({ score: 10, max: 10 });
      expect(qcm.evaluate(slug, 77, "normal", answers.slice(0, 3), anime).score).toBe(3);
      expect(qcm.evaluate(slug, 77, "normal", [], anime).score).toBe(0);
    }
  });

  it("propose quatre réponses, sauf pour les questions à deux issues", () => {
    for (const slug of qcm.QCM_SLUGS) {
      const expected = slug === "vrai-ou-faux" || slug === "grand-ou-vieux" ? [2] : slug === "mode-aleatoire" ? [2, 4] : [4];
      for (const q of qcm.generateQcm(slug, 5, "normal", anime)) expect(expected, `${slug} ${q.id}`).toContain(q.options.length);
    }
  });

  it("Orthographe : les mauvaises graphies diffèrent du nom sans toucher à sa première lettre", () => {
    const rng = createRng(9);
    for (const name of ["Donquixote Doflamingo", "Trafalgar D. Water Law", "Charlotte Katakuri", "Zeff"]) {
      for (let i = 0; i < 50; i++) {
        const wrong = qcm.misspell(rng, name);
        expect(wrong[0]).toBe(name[0]);
        expect(Math.abs(wrong.length - name.length)).toBeLessThanOrEqual(1);
      }
    }
    for (const q of qcm.generateQcm("orthographe", 3, "normal", anime)) {
      expect(q.img, q.id).toBeTruthy();
      // Le sujet affiché ne doit pas donner le nom
      expect(q.subject).not.toBe(q.answerId);
    }
  });

  it("Vrai ou faux : la réponse attendue dit vrai sur les primes", () => {
    for (const seed of SEEDS) {
      for (const q of qcm.generateQcm("vrai-ou-faux", seed, "normal", anime)) {
        if (!q.id.startsWith("prime:")) continue;
        const [, a, b] = q.id.split(":").map((id) => anime.characterById.get(id));
        expect(q.answerId, q.subject).toBe(a!.bounty! > b!.bounty! ? "vrai" : "faux");
      }
    }
  });
});

describe("estimation", () => {
  const log = { answer: 100_000_000, min: 1_000_000, max: 6_000_000_000, scale: "log" as const };
  const linear = { answer: 500, min: 1, max: 1001, scale: "linear" as const };

  it("note selon le rapport à la vraie valeur sur une échelle logarithmique", () => {
    expect(estimate.scoreEstimate(log, 100_000_000)).toBe(5);
    expect(estimate.scoreEstimate(log, 109_000_000)).toBe(5);
    expect(estimate.scoreEstimate(log, 80_000_000)).toBe(4);
    expect(estimate.scoreEstimate(log, 150_000_000)).toBe(3);
    expect(estimate.scoreEstimate(log, 50_000_000)).toBe(2);
    expect(estimate.scoreEstimate(log, 300_000_000)).toBe(1);
    expect(estimate.scoreEstimate(log, 1_000_000_000)).toBe(0);
    expect(estimate.scoreEstimate(log, 0)).toBe(0);
    expect(estimate.scoreEstimate(log, Number.NaN)).toBe(0);
  });

  it("note selon l'écart sur une échelle linéaire", () => {
    expect(estimate.scoreEstimate(linear, 505)).toBe(5);
    expect(estimate.scoreEstimate(linear, 525)).toBe(4);
    expect(estimate.scoreEstimate(linear, 440)).toBe(3);
    expect(estimate.scoreEstimate(linear, 600)).toBe(2);
    expect(estimate.scoreEstimate(linear, 320)).toBe(1);
    expect(estimate.scoreEstimate(linear, 900)).toBe(0);
  });

  it("fait parcourir au curseur toute l'étendue des valeurs", () => {
    expect(estimate.sliderToValue(log, 0)).toBe(1_000_000);
    expect(estimate.sliderToValue(log, 1)).toBe(6_000_000_000);
    expect(estimate.sliderToValue(linear, 0)).toBe(1);
    expect(estimate.sliderToValue(linear, 1)).toBe(1001);
    expect(estimate.sliderToValue(linear, 2)).toBe(1001);
    // Deux chiffres significatifs sur l'échelle logarithmique
    expect(String(estimate.sliderToValue(log, 0.43)).replace(/0+$/, "").length).toBeLessThanOrEqual(2);
  });

  it.each(estimate.ESTIMATE_SLUGS)("%s : huit questions dont la réponse tient dans l'étendue du curseur", (slug) => {
    for (const data of modes) {
      for (const seed of SEEDS.slice(0, 10)) {
        const questions = estimate.generateEstimates(slug, seed, "normal", data);
        expect(questions, `${slug} ${data.mode}`).toHaveLength(estimate.ESTIMATE_LENGTH);
        for (const q of questions) {
          expect(q.answer, `${slug} ${q.id}`).toBeGreaterThanOrEqual(q.min);
          expect(q.answer, `${slug} ${q.id}`).toBeLessThanOrEqual(q.max);
        }
        const perfect = questions.map((q) => q.answer);
        expect(estimate.evaluate(slug, seed, "normal", perfect, data)).toEqual({ score: 40, max: 40 });
      }
    }
  });

  it("demande des épisodes en mode anime et des chapitres en mode manga", () => {
    expect(estimate.generateEstimates("premiere-apparition", 1, "normal", modes[0])[0].unit).toBe("épisode");
    expect(estimate.generateEstimates("premiere-apparition", 1, "normal", modes[1])[0].unit).toBe("chapitre");
  });

  it("additionne les primes d'un équipage", () => {
    const strawHats = estimate.crewBounties(anime.characters).find((c) => c.crew === "Équipage du Chapeau de paille")!;
    const expected = anime.characters
      .filter((c) => c.affiliation === "Équipage du Chapeau de paille" && c.bounty !== null)
      .reduce((sum, c) => sum + c.bounty!, 0);
    expect(strawHats.total).toBe(expected);
    expect(strawHats.total).toBeGreaterThan(8_000_000_000);
  });
});

describe("jeux d'indices", () => {
  it.each(clues.CLUE_SLUGS)("%s : cinq manches, le premier indice ne donne pas le nom", (slug) => {
    for (const data of modes) {
      for (const seed of SEEDS.slice(0, 10)) {
        const rounds = clues.generateRounds(slug, seed, "normal", data);
        expect(rounds).toHaveLength(clues.CLUE_ROUNDS);
        expect(new Set(rounds.map((r) => r.target.id)).size).toBe(clues.CLUE_ROUNDS);
        for (const round of rounds) {
          expect(round.clues.length).toBeGreaterThanOrEqual(2);
          expect(round.clues.at(-1)!.title).toBe("Initiale");
          // Aucun indice ne contient un mot du nom à trouver
          const words = normalizeText(round.target.name).split(" ").filter((w) => w.length >= 3);
          for (const clue of round.clues.slice(0, -1)) {
            for (const word of words) expect(normalizeText(clue.value).split(" "), `${round.target.name} / ${clue.value}`).not.toContain(word);
          }
        }
      }
    }
  });

  it("retire un point par indice dévoilé, et tout à qui passe ou échoue", () => {
    const [round] = clues.generateRounds("les-indices", 4, "normal", anime);
    const found = { type: "guess", id: round.target.id } as const;
    const miss = { type: "guess", id: "personne" } as const;
    expect(clues.scoreRound(round, [found])).toBe(5);
    expect(clues.scoreRound(round, [miss, found])).toBe(4);
    expect(clues.scoreRound(round, [{ type: "hint" }, { type: "hint" }, found])).toBe(3);
    expect(clues.scoreRound(round, [{ type: "pass" }, found])).toBe(0);
    expect(clues.scoreRound(round, [])).toBe(0);
    // Trop d'erreurs : plus d'indice à dévoiler, la manche est perdue
    expect(clues.scoreRound(round, [...Array(round.clues.length).fill(miss), found])).toBe(0);
    // Le dernier indice vaut encore un point
    expect(clues.scoreRound(round, [...Array(round.clues.length - 1).fill(miss), found])).toBe(1);
  });
});

describe("Chronologie", () => {
  it("alterne arcs et personnages, cinq éléments à ordonner sans égalité", () => {
    for (const data of modes) {
      for (const seed of SEEDS.slice(0, 10)) {
        const orders: string[][] = [];
        for (let index = 0; index < chronologie.ROUNDS; index++) {
          const round = chronologie.roundAt(seed, index, "normal", data);
          expect(round.items).toHaveLength(chronologie.ROUND_SIZE);
          expect(new Set(round.items.map((i) => i.order)).size).toBe(chronologie.ROUND_SIZE);
          expect(round.items[0].id.startsWith("arc-")).toBe(index % 2 === 0);
          orders.push(chronologie.correctOrder(round));
        }
        expect(chronologie.evaluate(seed, "normal", orders, data)).toEqual({ score: 25, max: 25 });
      }
    }
  });

  it("refuse un classement qui ne reprend pas les cinq éléments", () => {
    const round = chronologie.roundAt(1, 0, "normal", anime);
    const right = chronologie.correctOrder(round);
    expect(chronologie.scoreRound(round, right)).toBe(5);
    expect(chronologie.scoreRound(round, Array(5).fill(right[0]))).toBe(0);
    expect(chronologie.scoreRound(round, right.slice(0, 4))).toBe(0);
    expect(chronologie.scoreRound(round, [...right].reverse())).toBe(1);
  });
});

describe("Anagramme", () => {
  it("mélange les lettres du nom sans les changer", () => {
    for (const seed of SEEDS) {
      const rounds = anagramme.generateRounds(seed, "normal", anime.characters);
      expect(rounds).toHaveLength(anagramme.ROUNDS);
      for (const round of rounds) {
        const name = round.target.name.toUpperCase();
        expect([...round.letters].sort().join("")).toBe([...name].sort().join(""));
        expect(round.letters).not.toBe(name);
      }
    }
  });

  it("accepte le nom sans tenir compte de la casse ni des accents", () => {
    const rounds = anagramme.generateRounds(8, "normal", anime.characters);
    const answers = rounds.map((r, i) => (i % 2 === 0 ? r.target.name.toLowerCase() : "faux"));
    expect(anagramme.evaluate(8, "normal", answers, anime.characters)).toEqual({ score: 4, max: 8 });
  });
});

describe("Wordle", () => {
  it("signale les lettres bien placées, mal placées et absentes", () => {
    expect(wordle.feedback("SANJI", "SANJI")).toEqual(["exact", "exact", "exact", "exact", "exact"]);
    expect(wordle.feedback("NAMIS", "SANJI")).toEqual(["present", "exact", "absent", "present", "present"]);
    // Une lettre n'est signalée qu'autant de fois qu'elle figure dans le mot
    expect(wordle.feedback("AAAAB", "ABCDE")).toEqual(["exact", "absent", "absent", "absent", "present"]);
    expect(wordle.feedback("EERIE", "REBEL")).toEqual(["present", "exact", "present", "absent", "absent"]);
  });

  it("note selon le nombre d'essais et ignore les essais mal formés", () => {
    const target = wordle.toWord(wordle.targetOf(21, "normal", anime.characters).name);
    const other = "Z".repeat(target.length);
    expect(wordle.evaluate(21, "normal", [target], anime.characters)).toEqual({ score: 6, max: 6 });
    expect(wordle.evaluate(21, "normal", [other, other, target], anime.characters).score).toBe(4);
    expect(wordle.evaluate(21, "normal", ["TROPLONGPOURCEMOT", target], anime.characters).score).toBe(6);
    expect(wordle.evaluate(21, "normal", Array(6).fill(other).concat(target), anime.characters).score).toBe(0);
    expect(target).toMatch(/^[A-Z]{4,8}$/);
  });
});

describe("Mémo", () => {
  it("distribue huit paires personnage / fruit, toutes différentes", () => {
    for (const data of modes) {
      for (const seed of SEEDS.slice(0, 10)) {
        const deck = memo.generateDeck(seed, "normal", data);
        expect(deck).toHaveLength(memo.PAIRS * 2);
        for (let pair = 0; pair < memo.PAIRS; pair++) {
          expect(deck.filter((card) => card.pair === pair).map((card) => card.kind).sort()).toEqual(["character", "fruit"]);
        }
        expect(new Set(deck.map((card) => card.label)).size).toBe(deck.length);
      }
    }
  });

  it("note une partie terminée selon le nombre de coups, et rien si elle ne l'est pas", () => {
    const deck = memo.generateDeck(3, "normal", anime);
    const pairs = Array.from({ length: memo.PAIRS }, (_, pair) => {
      const [a, b] = deck.map((card, index) => ({ card, index })).filter(({ card }) => card.pair === pair);
      return [a.index, b.index] as [number, number];
    });
    expect(memo.evaluate(3, "normal", pairs, anime)).toEqual({ score: 16, max: 16 });

    const mismatch: [number, number] = [pairs[0][0], pairs[1][0]];
    expect(memo.evaluate(3, "normal", [mismatch, mismatch, ...pairs], anime).score).toBe(14);
    expect(memo.evaluate(3, "normal", pairs.slice(0, 7), anime).score).toBe(0);
    // Retourner deux fois la même carte ou une carte inexistante ne compte pas
    expect(memo.evaluate(3, "normal", [[0, 0], [0, 99], ...pairs], anime).score).toBe(16);
  });
});

describe("comptes rendus des nouveaux jeux", () => {
  const context = { data: anime, animeCharacters: anime.characters, today: "2026-10-05" };
  const run = (report: GameReport) => evaluateReport(reportSchema.parse(report), context);
  const base = { seed: 12, mode: "anime", difficulty: "normal" } as const;

  it("aiguille chaque jeu vers son recalcul", () => {
    const answers = qcm.generateQcm("haki", 12, "normal", anime).map((q) => q.answerId);
    expect(run({ slug: "haki", ...base, answers })).toMatchObject({ score: 10, max: 10, category: "savoir" });

    const estimates = estimate.generateEstimates("devine-la-prime", 12, "normal", anime).map((q) => q.answer);
    expect(run({ slug: "devine-la-prime", ...base, answers: estimates })).toMatchObject({ score: 40, category: "primes" });

    const rounds = clues.generateRounds("emojis", 12, "normal", anime).map((r) => [{ type: "guess" as const, id: r.target.id }]);
    expect(run({ slug: "emojis", ...base, rounds })).toMatchObject({ score: 25, max: 25, category: "mots" });

    const target = wordle.toWord(wordle.targetOf(12, "normal", anime.characters).name);
    expect(run({ slug: "wordle", ...base, guesses: [target] })).toMatchObject({ score: 6, performance: 1 });
    expect(run({ slug: "anagramme", ...base, answers: [] })).toMatchObject({ score: 0, max: 8 });
    expect(run({ slug: "memo", ...base, flips: [] })).toMatchObject({ score: 0, category: "oeil" });
    expect(run({ slug: "chronologie", ...base, orders: [] })).toMatchObject({ score: 0, max: 25 });
  });

  it("refuse des réponses hors format", () => {
    expect(reportSchema.safeParse({ slug: "haki", ...base, answers: Array(11).fill("x") }).success).toBe(false);
    expect(reportSchema.safeParse({ slug: "devine-la-prime", ...base, answers: [-5] }).success).toBe(false);
    expect(reportSchema.safeParse({ slug: "memo", ...base, flips: [[0, 99]] }).success).toBe(false);
    expect(reportSchema.safeParse({ slug: "wordle", ...base, guesses: Array(7).fill("AAAA") }).success).toBe(false);
  });
});
