import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { arcOfChapter, arcs, characterById, characters, crewById, fruitById, fruits, meta, sagas, ships } from "@/lib/data";
import { DATASET_FILES } from "@/lib/data/schema";
import { currentBounty, isPlayableCharacter } from "@/lib/spoilers";

const generated = (name: string) =>
  JSON.parse(readFileSync(path.resolve(import.meta.dirname, `../data/generated/${name}.json`), "utf8"));

describe("fichiers générés", () => {
  it.each(Object.keys(DATASET_FILES))("%s.json respecte son schéma", (name) => {
    const result = DATASET_FILES[name as keyof typeof DATASET_FILES].safeParse(generated(name));
    expect(result.error?.issues.slice(0, 5) ?? []).toEqual([]);
  });

  it("n'a pas d'identifiant en double", () => {
    for (const list of [characters, fruits, arcs, sagas, ships]) {
      const ids = list.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("n'a pas de référence cassée", () => {
    for (const c of characters) {
      if (c.fruitId) expect(fruitById.has(c.fruitId), `${c.id} → fruit ${c.fruitId}`).toBe(true);
      if (c.crewId) expect(crewById.has(c.crewId), `${c.id} → équipage ${c.crewId}`).toBe(true);
    }
    for (const f of fruits) {
      for (const userId of f.userIds) expect(characterById.get(userId)?.fruitId).toBe(f.id);
    }
    const sagaIds = new Set(sagas.map((s) => s.id));
    for (const arc of arcs) expect(sagaIds.has(arc.sagaId)).toBe(true);
  });
});

describe("arcs", () => {
  const manga = arcs.filter((a) => a.chapters).sort((a, b) => a.chapters!.first - b.chapters!.first);

  it("couvrent tous les chapitres, sans trou ni chevauchement", () => {
    expect(manga[0].chapters!.first).toBe(1);
    for (let i = 1; i < manga.length; i++) {
      expect(manga[i].chapters!.first).toBe(manga[i - 1].chapters!.last + 1);
    }
    expect(manga[manga.length - 1].chapters!.last).toBe(meta.latestChapter);
  });

  it("situent un chapitre dans le bon arc", () => {
    expect(arcOfChapter(1)?.id).toBe("romance-dawn");
    expect(arcOfChapter(100)?.id).toBe("loguetown");
    expect(arcOfChapter(700)?.id).toBe("dressrosa");
    expect(arcOfChapter(1058)?.id).toBe("egg-head");
  });
});

describe("personnages", () => {
  it("atteint le volume visé de personnages jouables", () => {
    expect(characters.filter((c) => isPlayableCharacter(c, "manga")).length).toBeGreaterThanOrEqual(300);
    expect(characters.filter((c) => isPlayableCharacter(c, "anime")).length).toBeGreaterThanOrEqual(300);
  });

  it("classe les primes de la plus récente à la plus ancienne", () => {
    // Une prime ne fait que monter : la liste doit donc décroître. L'ordre des
    // chapitres de révélation, lui, n'est pas garanti (primes vues en flashback).
    for (const c of characters) {
      const amounts = c.bounties.map((b) => b.amount);
      expect(amounts, c.id).toEqual([...amounts].sort((x, y) => y - x));
    }
  });

  it("connaît les repères incontestables", () => {
    const luffy = characterById.get("monkey-d-luffy")!;
    expect(luffy).toMatchObject({
      name: { fr: "Monkey D. Luffy" },
      canon: true,
      debut: { chapter: 1, episode: 1 },
      gender: "male",
      fruitId: "gomu-gomu-no-mi",
      haki: { observation: true, armament: true, conqueror: true },
    });
    expect(currentBounty(luffy)).toBe(3_000_000_000);
    expect(luffy.origin?.sea).toBe("east-blue");
    expect(fruitById.get("gomu-gomu-no-mi")?.userIds).toContain("monkey-d-luffy");

    expect(characterById.get("roronoa-zoro")).toMatchObject({ canon: true, debut: { chapter: 3 } });
    expect(characterById.get("nami")).toMatchObject({ gender: "female", fruitId: null });
    expect(characterById.get("tony-tony-chopper")?.bounties[0].amount).toBe(1000);
    expect(characterById.get("buggy")).toMatchObject({ name: { fr: "Baggy" }, fruitId: "bara-bara-no-mi" });
    expect(fruitById.get("mera-mera-no-mi")?.type).toBe("logia");
  });

  it("écarte les personnages de films des tirages", () => {
    const tesoro = characters.find((c) => c.wikiTitle === "Gild Tesoro")!;
    expect(tesoro.canon).toBe(false);
    expect(isPlayableCharacter(tesoro, "manga")).toBe(false);
  });
});
