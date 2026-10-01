import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildGameData, resolveGameData, type ResolvedData } from "@/games/cards";
import * as chronologie from "@/games/chronologie/logic";
import * as clues from "@/games/clues/logic";
import * as dcc from "@/games/duo-carre-cash/logic";
import { criteriaFor } from "@/games/engine/criteria";
import { DIFFICULTIES } from "@/games/engine/difficulty";
import { formatBounty, formatHeight, formatNumber, normalizeText } from "@/games/engine/text";
import * as estimate from "@/games/estimate/logic";
import * as onepiecedle from "@/games/onepiecedle/logic";
import * as qcm from "@/games/qcm/logic";
import { evaluateReport } from "@/games/report";
import { arcs } from "@/lib/data";
import { translateAffiliation } from "@/lib/data/labels";
import { dailyGames, OBJECTIVES, POSTS, RANKS, TRAITS, weeklyChallenges } from "@/lib/economy";
import { GAME_CATEGORIES, GAMES } from "@/lib/games/catalog";
import { LOCALES, localePath, preferredLocale, splitLocale, translator, type Localized } from "@/lib/i18n";
import type { RoomView } from "@/lib/multi/types";
import { accountsEnabled, db } from "@/lib/server/db";
import { DUMMY_HASH } from "@/lib/server/password";
import { submitGame } from "@/lib/server/player";
import { createRoom, startRoom, viewRoom } from "@/lib/server/rooms";
import { pageAlternates } from "@/lib/site";

const fr = resolveGameData(buildGameData("fr"), "manga");
const en = resolveGameData(buildGameData("en"), "manga");
const SEEDS = Array.from({ length: 12 }, (_, i) => 500 + i * 53);

/** Mots français qui n'ont rien à faire dans un texte anglais produit par un jeu. */
const FRENCH = /\b(le|la|les|des|du|une|est|qui|quel|quelle|quels|dans|pour|avec|sur|équipage|prime|personnage|aucun|aucune)\b|[éèêàùç]/i;
const looksFrench = (text: string) => FRENCH.test(text);

describe("adresses", () => {
  it("laisse le français à la racine et range l'anglais sous /en", () => {
    expect(localePath("fr", "/")).toBe("/");
    expect(localePath("fr", "/jeux/wordle")).toBe("/jeux/wordle");
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "/jeux/wordle")).toBe("/en/jeux/wordle");
    expect(localePath("en", "/jeux#cat-oeil")).toBe("/en/jeux#cat-oeil");
    expect(localePath("en", "/#jeux-du-jour")).toBe("/en#jeux-du-jour");
  });

  it("retrouve la langue et le chemin d'une adresse", () => {
    expect(splitLocale("/")).toEqual({ locale: "fr", path: "/" });
    expect(splitLocale("/jeux/wordle")).toEqual({ locale: "fr", path: "/jeux/wordle" });
    expect(splitLocale("/en")).toEqual({ locale: "en", path: "/" });
    expect(splitLocale("/en/jeux/wordle")).toEqual({ locale: "en", path: "/jeux/wordle" });
    // Adresse interne des pages françaises, telle que le serveur la voit pendant le rendu
    expect(splitLocale("/fr")).toEqual({ locale: "fr", path: "/" });
    expect(splitLocale("/fr/jeux/wordle")).toEqual({ locale: "fr", path: "/jeux/wordle" });
    expect(splitLocale("/france")).toEqual({ locale: "fr", path: "/france" });
    // Une page dont le nom commence par « en » n'est pas une page anglaise
    expect(splitLocale("/enigmes")).toEqual({ locale: "fr", path: "/enigmes" });
    for (const locale of LOCALES) {
      for (const path of ["/", "/jeux", "/jeux/onepiecedle"]) expect(splitLocale(localePath(locale, path))).toEqual({ locale, path });
    }
  });

  it("choisit la langue du navigateur parmi celles du site", () => {
    expect(preferredLocale(null)).toBe("fr");
    expect(preferredLocale("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(preferredLocale("en-US,en;q=0.9")).toBe("en");
    expect(preferredLocale("en-GB,fr;q=0.9")).toBe("en");
    expect(preferredLocale("de-DE,en;q=0.7,fr;q=0.9")).toBe("fr");
    // Aucune langue du site : le français, langue par défaut
    expect(preferredLocale("ja,de;q=0.8")).toBe("fr");
    expect(preferredLocale("en;q=0,fr;q=0.5")).toBe("fr");
  });

  it("annonce chaque page dans les deux langues", () => {
    expect(pageAlternates("en", "/jeux/wordle")).toEqual({
      canonical: "/en/jeux/wordle",
      languages: { fr: "/jeux/wordle", en: "/en/jeux/wordle", "x-default": "/jeux/wordle" },
    });
    expect(pageAlternates("fr", "/").canonical).toBe("/");
  });

  it("traduit", () => {
    expect(translator("fr")("Jouer", "Play")).toBe("Jouer");
    expect(translator("en")("Jouer", "Play")).toBe("Play");
  });
});

describe("données des jeux en anglais", () => {
  it("contient les mêmes personnages, fruits et groupes qu'en français", () => {
    expect(en.locale).toBe("en");
    expect(fr.locale).toBe("fr");
    expect(en.characters.map((c) => c.id)).toEqual(fr.characters.map((c) => c.id));
    expect(en.fruits.map((f) => f.id)).toEqual(fr.fruits.map((f) => f.id));
    expect(en.groups.map((g) => g.id)).toEqual(fr.groups.map((g) => g.id));
    expect([...en.arcs.keys()]).toEqual([...fr.arcs.keys()]);
  });

  it("nomme les personnages et leur affiliation en anglais, sans changer leur organisation", () => {
    const get = (data: ResolvedData, id: string) => data.characterById.get(id)!;
    expect(get(en, "buggy").name).toBe("Buggy");
    expect(get(fr, "buggy").name).toBe("Baggy");
    expect(get(en, "monkey-d-luffy")).toMatchObject({ org: "Straw Hat Pirates", affiliation: "Straw Hat Pirates" });
    expect(get(fr, "monkey-d-luffy")).toMatchObject({ org: "Straw Hat Pirates", affiliation: "Équipage du Chapeau de paille" });
    expect(get(en, "monkey-d-garp").affiliation).toBe("Marines");
    for (const character of en.characters) expect(character.org, character.id).toBe(get(fr, character.id).org);
    // Le nom français reste accepté à la saisie
    expect(get(en, "buggy").aliases).toContain("Baggy");
    expect(get(en, "buggy").altName).toBeNull();
  });

  it("donne aux arcs un vrai titre anglais", () => {
    const titles = [...en.arcs.values()];
    expect(en.arcs.get(19)).toBe("Skypiea");
    expect(en.arcs.get(47)).toBe("Wano Country");
    for (const title of titles) {
      expect(title, title).not.toMatch(/\b(arc|arch|bow)\b/i);
      expect(looksFrench(title), title).toBe(false);
    }
    // Tous les arcs, y compris ceux que les jeux n'utilisent pas, ont un titre anglais relu
    for (const arc of arcs) expect(arc.title.en, arc.id).toMatch(/ Arc$/);
  });

  it("ne donne pas le nom du personnage dans son surnom anglais", () => {
    expect(en.extras.epithets).toHaveLength(fr.extras.epithets.length);
    for (const { characterId, text } of en.extras.epithets) {
      const name = en.characterById.get(characterId)!.name;
      for (const word of normalizeText(name).split(" ").filter((w) => w.length > 2)) {
        expect(normalizeText(text).split(" "), `${characterId} : ${text}`).not.toContain(word);
      }
    }
  });

  it("traduit les contenus rédigés qui en ont besoin", () => {
    expect(en.extras.ships.find((ship) => ship.name === "Going Merry")?.crew).toBe("Straw Hat Pirates");
    expect(fr.extras.ships.find((ship) => ship.name === "Vogue Merry")?.crew).toBe("Équipage du Chapeau de paille");
    expect(en.extras.weapons.find((weapon) => weapon.name === "Yoru")?.kind).toBe("black blade");
    expect(en.groups.find((group) => group.id === "chapeau-de-paille")?.title).toBe("The Straw Hat Pirates");
    for (const weapon of en.extras.weapons) expect(looksFrench(weapon.kind), weapon.kind).toBe(false);
  });

  it("met en forme les nombres selon la langue", () => {
    expect(formatNumber(1_500_000, "en")).toBe("1,500,000");
    expect(formatNumber(1_500_000, "fr").replace(/\s/g, " ")).toBe("1 500 000");
    expect(formatBounty(null, "en")).toBe("None");
    expect(formatBounty(null, "fr")).toBe("Aucune");
    expect(formatHeight(null, "en")).toBe("Unknown");
    expect(formatHeight(1240, "en")).toBe("12.4 m");
    expect(formatHeight(1240, "fr")).toBe("12,4 m");
  });

  it("lit les nombres tapés à l'anglaise comme à la française", () => {
    expect(estimate.parseEstimate("1,500,000,000")).toBe(1_500_000_000);
    expect(estimate.parseEstimate("1.5 billion")).toBe(1_500_000_000);
    expect(estimate.parseEstimate("3bn")).toBe(3_000_000_000);
    expect(estimate.parseEstimate("320M")).toBe(320_000_000);
    expect(estimate.parseEstimate("1,5 md")).toBe(1_500_000_000);
    expect(estimate.parseEstimate("500 Berries")).toBe(500);
  });
});

describe("jeux en anglais", () => {
  it("pose les questions des quiz en anglais", () => {
    for (const slug of qcm.QCM_SLUGS) {
      for (const seed of SEEDS) {
        const questions = qcm.generateQcm(slug, seed, "normal", en);
        expect(questions.length, slug).toBeGreaterThan(0);
        for (const question of questions) {
          expect(looksFrench(question.title), `${slug} : ${question.title}`).toBe(false);
          expect(question.options.some((option) => option.id === question.answerId), `${slug} : ${question.id}`).toBe(true);
          expect(new Set(question.options.map((option) => option.id)).size).toBe(question.options.length);
        }
        // Les bonnes réponses, rejouées dans la même langue, font le score maximal
        const answers = questions.map((question) => question.answerId);
        expect(qcm.evaluate(slug, seed, "normal", answers, en), slug).toEqual({ score: questions.length, max: questions.length });
      }
    }
  });

  it("garde « vrai » et « faux » comme réponses, quel que soit leur libellé", () => {
    const [question] = qcm.generateQcm("vrai-ou-faux", 7, "normal", en);
    expect(question.options).toEqual([
      { id: "vrai", label: "True" },
      { id: "faux", label: "False" },
    ]);
    expect(looksFrench(question.subject), question.subject).toBe(false);
  });

  it("ne note juste une partie que dans la langue où elle a été jouée", () => {
    // Les libellés servent de réponses : le serveur doit rejouer la partie avec les données de la même langue
    const seed = SEEDS[0];
    const answers = qcm.generateQcm("equipage", seed, "normal", en).map((question) => question.answerId);
    const report = { slug: "equipage", seed, mode: "manga", difficulty: "normal", answers } as const;
    const context = (data: ResolvedData) => ({ data, animeCharacters: data.characters, today: "2026-10-01" });
    expect(evaluateReport(report, context(en))).toMatchObject({ score: 10, max: 10 });
    expect(evaluateReport(report, context(fr))!.score).toBeLessThan(10);
  });

  it("tire le même personnage du jour dans les deux langues", () => {
    for (const day of ["2026-10-01", "2026-10-02", "2026-12-25", "2027-03-14"]) {
      expect(onepiecedle.dailyTarget(en.characters, day).id).toBe(onepiecedle.dailyTarget(fr.characters, day).id);
      expect(dailyGames(day)).toHaveLength(5);
    }
  });

  it("compare les personnages avec des libellés anglais", () => {
    const luffy = en.characterById.get("monkey-d-luffy")!;
    const kaidou = en.characterById.get("kaidou")!;
    const cells = onepiecedle.compare(luffy, kaidou, en);
    expect(cells.find((cell) => cell.key === "gender")!.label).toBe("Male");
    expect(cells.find((cell) => cell.key === "haki")!.label).toBe("Observation, Armament, Conqueror's");
    for (const cell of cells) expect(looksFrench(cell.label), cell.label).toBe(false);
    for (const column of onepiecedle.COLUMNS) expect(column.title.en).not.toBe("");
  });

  it("donne des indices, des critères et des manches en anglais", () => {
    for (const slug of clues.CLUE_SLUGS) {
      for (const round of clues.generateRounds(slug, SEEDS[1], "normal", en)) {
        expect(round.clues.at(-1)!.title).toBe("Initial");
        for (const clue of round.clues) expect(looksFrench(clue.title), clue.title).toBe(false);
      }
    }
    for (const criterion of criteriaFor(en)) {
      if (criterion.kind === "affiliation" || criterion.kind === "group") continue;
      expect(looksFrench(criterion.label), criterion.label).toBe(false);
      expect(looksFrench(criterion.question), criterion.question).toBe(false);
    }
    for (let index = 0; index < chronologie.ROUNDS; index++) {
      expect(looksFrench(chronologie.roundAt(SEEDS[2], index, "normal", en).prompt)).toBe(false);
    }
    for (const slug of estimate.ESTIMATE_SLUGS) {
      for (const question of estimate.generateEstimates(slug, SEEDS[3], "normal", en)) {
        expect(looksFrench(question.title), question.title).toBe(false);
      }
    }
  });

  it("accepte en cash la forme courte d'un équipage anglais", () => {
    expect(dcc.labelForms("Straw Hat Pirates")).toEqual(["Straw Hat Pirates", "Straw Hat"]);
    expect(dcc.labelForms("Alabasta Kingdom")).toEqual(["Alabasta Kingdom", "Alabasta"]);
    expect(dcc.labelForms("Marines")).toEqual(["Marines"]);
    const questions = dcc.generate(SEEDS[4], "normal", en);
    expect(questions).toHaveLength(dcc.DCC_LENGTH);
    const answers = questions.map((question) => ({ kind: "carre" as const, value: question.answerId }));
    expect(dcc.evaluate(SEEDS[4], "normal", answers, en).score).toBe(dcc.DCC_LENGTH * dcc.DCC_POINTS.carre);
  });
});

describe("textes du site", () => {
  const complete = (text: Localized, where: string) => {
    expect(text.fr, where).not.toBe("");
    expect(text.en, where).not.toBe("");
  };

  it("existent dans les deux langues", () => {
    for (const game of GAMES) {
      complete(game.title, game.slug);
      complete(game.pitch, game.slug);
    }
    for (const category of GAME_CATEGORIES) {
      complete(category.title, category.id);
      complete(category.description, category.id);
    }
    for (const difficulty of DIFFICULTIES) {
      complete(difficulty.label, difficulty.id);
      complete(difficulty.hint, difficulty.id);
    }
    for (const [post, definition] of Object.entries(POSTS)) {
      complete(definition.label, post);
      complete(definition.effect, post);
    }
    for (const rank of RANKS) complete(rank.title, String(rank.from));
    for (const objective of OBJECTIVES) complete(objective.label, objective.id);
    for (const week of ["2026-S40", "2026-S41"]) {
      for (const challenge of weeklyChallenges(week)) complete(challenge.label, week);
    }
  });

  it("rattache chaque trait d'équipage à une organisation qui existe", () => {
    const orgs = new Set(fr.characters.map((character) => character.org));
    for (const org of Object.keys(TRAITS)) expect(orgs.has(org), org).toBe(true);
    // La clé ne dépend pas de la langue ; le libellé, si
    expect(translateAffiliation("Whitebeard Pirates", "fr")).toBe("Équipage de Barbe Blanche");
    expect(translateAffiliation("Whitebeard Pirates", "en")).toBe("Whitebeard Pirates");
    expect(translateAffiliation("Kouzuki Family", "en")).toBe("Kozuki Family");
  });
});

// Ces tests écrivent dans la base locale (docker compose up -d) ; ils sont ignorés sans DATABASE_URL.
describe.skipIf(!accountsEnabled)("langue côté serveur", () => {
  let user: { id: string; username: string };

  beforeAll(async () => {
    const username = `lang_${Date.now()}`;
    user = await db().user.create({
      data: { username, usernameKey: username, passwordHash: DUMMY_HASH },
      select: { id: true, username: true },
    });
  });
  afterAll(async () => {
    await db().user.delete({ where: { id: user.id } });
    await db().$disconnect();
  });

  it("rejoue une partie anglaise avec les données anglaises", async () => {
    const data = resolveGameData(buildGameData("en"), "anime");
    const report = (seed: number) => ({
      slug: "equipage",
      seed,
      mode: "anime",
      difficulty: "normal",
      answers: qcm.generateQcm("equipage", seed, "normal", data).map((question) => question.answerId),
    });

    const english = await submitGame(user.id, report(901), "2026-10-01", "en");
    if (!english.ok) throw new Error(english.reason);
    expect(english.outcome).toMatchObject({ score: 10, max: 10 });

    // La même partie annoncée en français : les réponses anglaises ne valent plus rien
    const mistaken = await submitGame(user.id, report(902), "2026-10-01", "fr");
    if (!mistaken.ok) throw new Error(mistaken.reason);
    expect(mistaken.outcome.score).toBeLessThan(10);
  });

  it("pose les questions d'un salon dans la langue de son hôte", async () => {
    const settings = { mode: "anime", difficulty: "normal", games: ["equipage"], questionCount: 5, seconds: 15 };
    const view = async (lang?: string): Promise<RoomView> => {
      const created = await createRoom(lang ? { ...settings, lang } : settings, { user });
      if (!created.ok) throw new Error(created.error);
      expect(await startRoom(created.ticket)).toEqual({ ok: true });
      const result = await viewRoom(created.ticket);
      await db().room.delete({ where: { code: created.ticket.code } });
      if (!result.ok || !("view" in result)) throw new Error("vue indisponible");
      return result.view;
    };

    const english = await view("en");
    expect(english.settings.lang).toBe("en");
    expect(english.question!.title).toBe("Which organization does this character belong to?");

    // Sans langue (ancien client), ou avec une langue inconnue : le français
    for (const lang of [undefined, "de"]) {
      const french = await view(lang);
      expect(french.settings.lang).toBe("fr");
      expect(french.question!.title).toBe("À quelle organisation appartient ce personnage ?");
    }
  });
});
