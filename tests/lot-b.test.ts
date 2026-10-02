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
import { RACE_LABELS } from "@/lib/data/labels";
import { DAILY_PASS } from "@/lib/economy/daily";

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

  it("Vrai ou faux : la réponse attendue dit vrai sur les tailles, les âges, les contenus rédigés et les races", () => {
    const seen = new Set<string>();
    const expected = (truth: boolean) => (truth ? "vrai" : "faux");
    for (const data of modes) {
      for (const seed of SEEDS) {
        for (const q of qcm.generateQcm("vrai-ou-faux", seed, "expert", data)) {
          const [kind, a, b] = q.id.split(":");
          const [first, second] = [data.characterById.get(a), data.characterById.get(b)];
          if (kind === "taille") expect(q.answerId, q.subject).toBe(expected(first!.height! > second!.height!));
          else if (kind === "age") expect(q.answerId, q.subject).toBe(expected(first!.age! > second!.age!));
          else if (kind === "avant") expect(q.answerId, q.subject).toBe(expected(first!.debut < second!.debut));
          else if (q.id.startsWith("surnom-")) {
            const id = q.id.slice("surnom-".length);
            const { text } = data.extras.epithets.find((e) => e.characterId === id)!;
            expect(q.answerId, q.subject).toBe(expected(q.subject.includes(`« ${text} »`)));
          } else if (q.id.startsWith("technique-")) {
            const technique = data.extras.techniques.find((t) => t.name === q.id.slice("technique-".length))!;
            expect(q.answerId, q.subject).toBe(expected(q.subject.endsWith(` ${data.characterById.get(technique.characterId)!.name}.`)));
          } else if (q.id.startsWith("arme-")) {
            const weapon = data.extras.weapons.find((w) => w.name === q.id.slice("arme-".length))!;
            expect(q.answerId, q.subject).toBe(expected(q.subject.endsWith(` ${data.characterById.get(weapon.characterId)!.name}.`)));
          } else if (q.id.startsWith("race-")) {
            const c = data.characterById.get(q.id.slice("race-".length))!;
            const shown = q.subject.slice(q.subject.lastIndexOf(": ") + 2, -1);
            expect(q.answerId, q.subject).toBe(expected(c.races.some((race) => RACE_LABELS.fr[race] === shown)));
            expect(q.explanation).not.toContain("undefined");
          } else if (q.id.startsWith("fruit-nom-")) {
            const c = data.characterById.get(q.id.slice("fruit-nom-".length))!;
            expect(q.answerId, q.subject).toBe(expected(q.subject.endsWith(`: ${data.fruitById.get(c.fruitId!)!.name}.`)));
          } else continue;
          seen.add(kind.split("-")[0]);
        }
      }
    }
    // Chaque nouvelle famille d'affirmations sort au moins une fois
    expect([...seen].sort()).toEqual(["age", "arme", "avant", "fruit", "race", "surnom", "taille", "technique"]);
  });

  it("pose aussi les questions dans l'autre sens, sans leurre qui serait une bonne réponse", () => {
    const closedSlugs = ["navires", "techniques", "armes-et-sabres", "surnoms", "dans-quel-arc", "origine-et-race", "haki"] as const;
    for (const slug of closedSlugs) {
      const questions = SEEDS.flatMap((seed) => modes.flatMap((data) => qcm.generateQcm(slug, seed, "normal", data).map((q) => ({ q, data }))));
      const closed = questions.filter(({ q }) => q.closed);
      // Les deux sens existent, le sens direct reste le plus fréquent
      expect(closed.length, slug).toBeGreaterThan(0);
      expect(closed.length, slug).toBeLessThan(questions.length / 2);

      for (const { q, data } of closed) {
        const decoys = q.options.filter((option) => option.id !== q.answerId);
        expect(q.options, q.id).toHaveLength(4);
        if (slug === "navires") {
          const ships = data.extras.ships.filter((ship) => ship.crew === q.subject).map((ship) => ship.name);
          expect(ships).toEqual([q.answerId]);
        } else if (slug === "dans-quel-arc") {
          const arc = data.characterById.get(q.answerId)!.arc;
          for (const decoy of decoys) expect(data.characterById.get(decoy.id)!.arc, q.id).not.toBe(arc);
        } else if (slug === "haki") {
          expect(data.characterById.get(q.answerId)!.haki).toContain("conqueror");
          for (const decoy of decoys) expect(data.characterById.get(decoy.id)!.haki, q.id).not.toContain("conqueror");
        } else if (slug === "origine-et-race") {
          const target = data.characterById.get(q.answerId)!;
          for (const decoy of decoys) {
            const other = data.characterById.get(decoy.id)!;
            if (q.id.startsWith("qui-mer-")) expect(other.sea, q.id).not.toBe(target.sea);
            else expect(other.races.map((race) => RACE_LABELS.fr[race]), q.id).not.toContain(q.subject);
          }
        } else {
          // Technique, arme ou surnom : aucun leurre n'appartient au personnage affiché
          const owner = data.characters.find((c) => c.name === q.subject)!;
          const items =
            slug === "techniques"
              ? data.extras.techniques.map((t) => ({ label: t.name, characterId: t.characterId }))
              : slug === "armes-et-sabres"
                ? data.extras.weapons.map((w) => ({ label: w.name, characterId: w.characterId }))
                : data.extras.epithets.map((e) => ({ label: `« ${e.text} »`, characterId: e.characterId }));
          const own = items.filter((item) => item.characterId === owner.id).map((item) => item.label);
          expect(own, q.id).toContain(q.answerId);
          for (const decoy of decoys) expect(own, q.id).not.toContain(decoy.label);
        }
      }
    }
  });

  it("Équipage : dans l'autre sens, aucun leurre n'a jamais appartenu à l'organisation demandée", () => {
    let reversed = 0;
    for (const data of modes) {
      for (const seed of SEEDS) {
        for (const q of qcm.generateQcm("equipage", seed, "expert", data)) {
          if (!q.closed) continue;
          reversed++;
          expect(data.characterById.get(q.answerId)!.affiliation).toBe(q.subject);
          for (const option of q.options.filter((o) => o.id !== q.answerId)) {
            const decoy = data.characterById.get(option.id)!;
            expect(decoy.solo, `${q.subject} / ${decoy.name}`).toBe(true);
            expect(decoy.affiliation).not.toBe(q.subject);
          }
        }
      }
    }
    expect(reversed).toBeGreaterThan(20);
    // Luffy n'a qu'un équipage ; Robin, passée par Baroque Works, ne peut pas servir de leurre
    expect(anime.characterById.get("nico-robin")!.solo).toBe(false);
    expect(anime.characterById.get("nami")!.solo).toBe(false);
    expect(anime.characterById.get("king")!.solo).toBe(true);
  });

  it("Orthographe : fait aussi écrire des techniques et des armes, sous le portrait de leur propriétaire", () => {
    const kinds = new Set<string>();
    for (const seed of SEEDS) {
      for (const q of qcm.generateQcm("orthographe", seed, "normal", anime)) {
        expect(q.img, q.id).toBeTruthy();
        expect(q.options.filter((option) => option.id === q.answerId)).toHaveLength(1);
        const item = q.id.startsWith("technique-")
          ? anime.extras.techniques.find((technique) => `technique-${technique.name}` === q.id)
          : q.id.startsWith("arme-")
            ? anime.extras.weapons.find((weapon) => `arme-${weapon.name}` === q.id)
            : undefined;
        if (!item) continue;
        kinds.add(q.id.split("-")[0]);
        expect(q.answerId).toBe(item.name);
        expect(q.subject).toBe(anime.characterById.get(item.characterId)!.name);
      }
    }
    expect([...kinds].sort()).toEqual(["arme", "technique"]);
  });

  it("Grand ou vieux : demande aussi le plus petit et le plus jeune", () => {
    let least = 0;
    for (const seed of SEEDS) {
      for (const q of qcm.generateQcm("grand-ou-vieux", seed, "normal", anime)) {
        const [a, b] = q.options.map((option) => anime.characterById.get(option.id)!);
        const criterion = q.id.replace(/^min-/, "").startsWith("height") ? "height" : "age";
        const taller = a[criterion]! > b[criterion]! ? a : b;
        const smaller = taller === a ? b : a;
        if (q.id.startsWith("min-")) least++;
        expect(q.answerId, q.title).toBe((q.id.startsWith("min-") ? smaller : taller).id);
        expect(/petit|jeune/.test(q.title), q.title).toBe(q.id.startsWith("min-"));
      }
    }
    expect(least).toBeGreaterThan(20);
  });

  it("étoffe les contenus rédigés : assez de matière pour ne pas revoir les mêmes questions", () => {
    expect(raw.extras.techniques.length).toBeGreaterThanOrEqual(250);
    expect(raw.extras.epithets.length).toBeGreaterThanOrEqual(115);
    expect(raw.extras.weapons.length).toBeGreaterThanOrEqual(35);
    expect(raw.extras.ships.length).toBeGreaterThanOrEqual(35);
    expect(raw.extras.emojis.length).toBeGreaterThanOrEqual(170);
    expect(new Set(raw.extras.emojis.map((entry) => entry.emojis)).size).toBe(raw.extras.emojis.length);
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

  it("Première apparition : 10 points au numéro exact, un haut de barème serré, encore 2 points à 99 d'écart", () => {
    const [question] = estimate.generateEstimates("premiere-apparition", SEEDS[0], "normal", modes[1]);
    expect(estimate.maxPoints(question)).toBe(10);
    const at = (gap: number) => estimate.scoreEstimate(question, question.answer + gap);
    expect([0, 1, 5, 6, 10, 11, 25, 26, 42, 43, 61, 62, 74, 75, 86, 87, 99, 100, 150, 151, 500].map(at)).toEqual([
      10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0, 0,
    ]);
    // L'écart compte dans les deux sens
    if (question.answer > 5) expect(estimate.scoreEstimate(question, question.answer - 3)).toBe(9);
    // Huit réponses à 61 numéros d'écart : la moitié des points, de quoi valider le jeu du jour
    const questions = estimate.generateEstimates("premiere-apparition", SEEDS[2], "normal", modes[1]);
    const near = questions.map((q) => (q.answer > 61 ? q.answer - 61 : q.answer + 61));
    const outcome = estimate.evaluate("premiere-apparition", SEEDS[2], "normal", near, modes[1]);
    expect(outcome.score / outcome.max).toBeGreaterThanOrEqual(DAILY_PASS);

    for (const data of modes) {
      const questions = estimate.generateEstimates("premiere-apparition", SEEDS[1], "normal", data);
      const perfect = questions.map((q) => q.answer);
      expect(estimate.evaluate("premiere-apparition", SEEDS[1], "normal", perfect, data)).toEqual({ score: 80, max: 80 });
    }
    // Les estimations de primes gardent leur barème sur 5
    expect(estimate.evaluate("devine-la-prime", SEEDS[1], "normal", [], anime).max).toBe(40);
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
        const max = slug === "premiere-apparition" ? 80 : 40;
        expect(estimate.evaluate(slug, seed, "normal", perfect, data)).toEqual({ score: max, max });
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
    const score = (events: clues.ClueEvent[]) => clues.scoreRound("les-indices", round, events);
    expect(score([found])).toBe(10);
    expect(score([miss, found])).toBe(9);
    expect(score([{ type: "hint" }, { type: "hint" }, found])).toBe(8);
    expect(score([{ type: "pass" }, found])).toBe(0);
    expect(score([])).toBe(0);
    // Trop d'erreurs : plus d'indice à dévoiler, la manche est perdue
    expect(score([...Array(round.clues.length).fill(miss), found])).toBe(0);
    // Avec l'initiale, la manche ne vaut plus que deux points
    expect(score([...Array(round.clues.length - 1).fill(miss), found])).toBe(2);
  });

  it("les-indices : trouver avant l'initiale garde au moins la moitié des points", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((revealed) => clues.pointsFor("les-indices", revealed, 7))).toEqual([10, 9, 8, 7, 6, 5, 2]);
    // Un indice en moins (pas de mer d'origine) : l'initiale reste le dernier palier
    expect([4, 5, 6].map((revealed) => clues.pointsFor("les-indices", revealed, 6))).toEqual([7, 6, 2]);
    for (const seed of SEEDS.slice(0, 10)) {
      const rounds = clues.generateRounds("les-indices", seed, "normal", anime);
      // Chaque personnage trouvé au dernier indice avant l'initiale : le jeu du jour est validé
      const events = rounds.map((round) => [...Array(round.clues.length - 2).fill({ type: "hint" }), { type: "guess", id: round.target.id }]);
      const { score, max } = clues.evaluate("les-indices", seed, "normal", events, anime);
      expect(max).toBe(50);
      expect(score / max).toBeGreaterThanOrEqual(DAILY_PASS);
    }
  });

  it("donne le surnom en dernier indice avant l'initiale, quand le personnage en a un", () => {
    let withEpithet = 0;
    for (const seed of SEEDS) {
      for (const round of clues.generateRounds("les-indices", seed, "normal", anime)) {
        const epithet = anime.extras.epithets.find((entry) => entry.characterId === round.target.id);
        const titles = round.clues.map((clue) => clue.title);
        expect(titles.includes("Surnom")).toBe(!!epithet);
        if (!epithet) continue;
        withEpithet++;
        expect(titles.at(-2)).toBe("Surnom");
        expect(round.clues.at(-2)!.value).toBe(`« ${epithet.text} »`);
      }
    }
    expect(withEpithet).toBeGreaterThan(10);
  });

  it("emojis : la difficulté choisit des personnages plus ou moins connus", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      for (const round of clues.generateRounds("emojis", seed, "facile", anime)) expect(round.target.tier).toBe(1);
      for (const round of clues.generateRounds("emojis", seed, "normal", anime)) expect(round.target.tier).toBeLessThanOrEqual(2);
    }
  });

  it("emojis : un point de moins par indice, de 5 à 1", () => {
    expect([1, 2, 3, 4, 5].map((revealed) => clues.pointsFor("emojis", revealed, 5))).toEqual([5, 4, 3, 2, 1]);
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
  it("distribue huit paires toutes différentes : chaque personnage avec son fruit, son surnom ou son arme", () => {
    const themes = new Set<string>();
    for (const data of modes) {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS) {
          const deck = memo.generateDeck(seed, difficulty, data);
          const theme = memo.themeOf(deck);
          themes.add(theme);
          expect(deck).toHaveLength(memo.PAIRS * 2);
          expect(new Set(deck.map((card) => card.label)).size).toBe(deck.length);
          for (let pair = 0; pair < memo.PAIRS; pair++) {
            const cards = deck.filter((card) => card.pair === pair);
            expect(cards.map((card) => card.kind).sort()).toEqual(["character", theme].sort());
            // La carte jumelle est bien celle du personnage
            const character = data.characters.find((c) => c.name === cards.find((card) => card.kind === "character")!.label)!;
            const other = cards.find((card) => card.kind !== "character")!.label;
            const own =
              theme === "fruit"
                ? [data.fruitById.get(character.fruitId!)!.name]
                : theme === "epithet"
                  ? data.extras.epithets.filter((e) => e.characterId === character.id).map((e) => `« ${e.text} »`)
                  : data.extras.weapons.filter((w) => w.characterId === character.id).map((w) => w.name);
            expect(own, `${character.name} / ${other}`).toContain(other);
          }
        }
      }
    }
    expect([...themes].sort()).toEqual(["epithet", "fruit", "weapon"]);
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
