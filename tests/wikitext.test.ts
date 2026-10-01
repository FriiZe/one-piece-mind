import { describe, expect, it } from "vitest";
import { cleanValue, collectNamedRefs, extractTemplate, parseEntries } from "../scripts/data/lib/wikitext";

describe("extractTemplate", () => {
  it("lit les paramètres d'une infobox malgré les modèles et liens imbriqués", () => {
    const text = `intro {{Char Box
| first = [[Chapter 9]]; [[Episode 4]]{{Qref|name=debut|chap=9|ep=4|Buggy [[Buggy|debuts]].}}
| epithet = {{Nihongo|"Buggy the Clown"|道化のバギー|Dōke no Bagī}}
| affiliation = [[Cross Guild|The Guild]]
}} suite`;
    const params = extractTemplate(text, "Char Box");
    expect(params).toMatchObject({ affiliation: "[[Cross Guild|The Guild]]" });
    expect(params?.first).toContain("[[Chapter 9]]");
    expect(cleanValue(params!.epithet)).toBe('"Buggy the Clown"');
  });

  it("renvoie null quand le modèle est absent", () => {
    expect(extractTemplate("{{Autre|a=1}}", "Char Box")).toBeNull();
  });
});

describe("parseEntries", () => {
  it("date chaque entrée par le chapitre de sa référence", () => {
    const value =
      "{{B}}3,000,000,000{{Qref|name=c1053|chap=1053|ep=1080|New bounty.}}<br/>\n" +
      "{{B}}<s>1,500,000,000</s>{{Qref|chap=903|ep=879}}";
    expect(parseEntries(value, new Map())).toEqual([
      { text: "3,000,000,000", since: 1053, offCanon: false },
      { text: "1,500,000,000", since: 903, offCanon: false },
    ]);
  });

  it("rattache à l'entrée précédente une référence placée après le point-virgule", () => {
    const value = "[[Pirate Captain]];{{Qref|chap=2}} [[Four Emperors|Emperor]];{{Qref|chap=1053}} Bandit (former)";
    expect(parseEntries(value, new Map())).toEqual([
      { text: "Pirate Captain", since: 2, offCanon: false },
      { text: "Emperor", since: 1053, offCanon: false },
      { text: "Bandit (former)", since: null, offCanon: false },
    ]);
  });

  it("résout les références nommées, définies ailleurs ou nommées d'après le chapitre", () => {
    const params = {
      occupation: "Senior Officer{{Qref|name=post wano|chap=1058|ep=1086}}",
      bounty: "{{B}}366,000,000{{Qref|name=post wano}}<br>{{B}}66,000,000{{Qref|name=c801}}",
    };
    const entries = parseEntries(params.bounty, collectNamedRefs(params));
    expect(entries.map((e) => e.since)).toEqual([1058, 801]);
  });

  it("signale les entrées sourcées uniquement par un film", () => {
    const [canon, movie] = parseEntries(
      "{{B}}4,048,900,000{{Qref|chap=957}}<br />{{B}}1,040,000,000{{Qref|name=filmred|movie=15}}",
      new Map(),
    );
    expect(canon.offCanon).toBe(false);
    expect(movie).toMatchObject({ since: null, offCanon: true });
  });
});
