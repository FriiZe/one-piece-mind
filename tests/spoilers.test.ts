import { describe, expect, it } from "vitest";
import { characters, fruits, meta } from "@/lib/data";
import type { Character } from "@/lib/data/schema";
import {
  chapterLimit,
  currentBounty,
  isKnown,
  isPlayableCharacter,
  isPlayableFruit,
  viewCharacter,
} from "@/lib/spoilers";

const CUTOFF = 1000;

const base: Character = {
  id: "test",
  apiId: 0,
  wikiTitle: null,
  name: { fr: "Test", en: "Test" },
  aliases: [],
  canon: true,
  debut: { chapter: 900, episode: 900 },
  gender: null,
  races: [],
  origin: { sea: "west-blue", place: "God Valley", since: 1158 },
  age: null,
  height: null,
  status: "alive",
  bounties: [
    { amount: 3_000_000_000, since: 1053 },
    { amount: 1_500_000_000, since: 903 },
  ],
  epithets: [{ en: "Old", since: null }, { en: "New", since: 1001 }],
  affiliations: [{ name: "Crew", former: false, since: 950 }, { name: "Secret", former: true, since: 1167 }],
  occupations: [{ name: "Emperor", former: false, since: 1053 }],
  crewId: null,
  job: null,
  fruitId: null,
  haki: { observation: false, armament: false, conqueror: false },
};

describe("règles de spoilers", () => {
  it("le mode manga n'a pas de limite, le mode anime s'arrête au dernier chapitre adapté", () => {
    expect(chapterLimit("manga")).toBe(Infinity);
    expect(chapterLimit("anime")).toBe(meta.animeCutoffChapter);
    expect(isKnown(null, "anime", CUTOFF)).toBe(true);
    expect(isKnown(CUTOFF, "anime", CUTOFF)).toBe(true);
    expect(isKnown(CUTOFF + 1, "anime", CUTOFF)).toBe(false);
    expect(isKnown(CUTOFF + 1, "manga", CUTOFF)).toBe(true);
  });

  it("retire en mode anime les faits révélés après la limite", () => {
    const view = viewCharacter(base, "anime", CUTOFF);
    expect(currentBounty(view)).toBe(1_500_000_000);
    expect(view.origin).toBeNull();
    expect(view.epithets.map((e) => e.en)).toEqual(["Old"]);
    expect(view.affiliations.map((a) => a.name)).toEqual(["Crew"]);
    expect(view.occupations).toEqual([]);
  });

  it("garde tout en mode manga", () => {
    expect(viewCharacter(base, "manga", CUTOFF)).toEqual(base);
    expect(currentBounty(base)).toBe(3_000_000_000);
  });

  it("écarte les personnages hors manga, non vérifiés ou pas encore apparus", () => {
    expect(isPlayableCharacter(base, "anime", CUTOFF)).toBe(true);
    expect(isPlayableCharacter({ ...base, canon: false }, "manga", CUTOFF)).toBe(false);
    expect(isPlayableCharacter({ ...base, debut: null }, "manga", CUTOFF)).toBe(false);
    expect(isPlayableCharacter({ ...base, debut: { chapter: 1001, episode: null } }, "anime", CUTOFF)).toBe(false);
    expect(isPlayableCharacter({ ...base, debut: { chapter: 1001, episode: null } }, "manga", CUTOFF)).toBe(true);
  });
});

describe("mode anime sur le vrai jeu de données", () => {
  const playable = characters.filter((c) => isPlayableCharacter(c, "anime"));

  it("ne tire aucun personnage ni fruit apparu après la limite", () => {
    for (const c of playable) expect(c.debut!.chapter!).toBeLessThanOrEqual(meta.animeCutoffChapter);
    for (const f of fruits.filter((f) => isPlayableFruit(f, "anime"))) {
      expect(f.debut!.chapter!).toBeLessThanOrEqual(meta.animeCutoffChapter);
    }
  });

  it("ne laisse passer aucun fait daté après la limite", () => {
    for (const c of playable) {
      const view = viewCharacter(c, "anime");
      const dated = [view.origin, ...view.bounties, ...view.epithets, ...view.affiliations, ...view.occupations];
      for (const fact of dated) {
        if (fact?.since != null) expect(fact.since).toBeLessThanOrEqual(meta.animeCutoffChapter);
      }
    }
  });

  it("masque réellement des faits récents (le filtre n'est pas sans effet)", () => {
    const hidden = characters.filter((c) => {
      const view = viewCharacter(c, "anime");
      return view.affiliations.length < c.affiliations.length || view.bounties.length < c.bounties.length;
    });
    expect(meta.animeCutoffChapter).toBeLessThan(meta.latestChapter);
    expect(hidden.length).toBeGreaterThan(0);
  });
});
