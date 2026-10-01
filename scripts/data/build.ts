/**
 * Construit le jeu de données du site (data/generated/*.json) à partir des
 * données brutes (data/raw, voir fetch-api.ts et fetch-wiki.ts) et des
 * corrections manuelles (data/overrides). Chaque fichier est validé par son
 * schéma Zod avant écriture.
 *
 * Usage : npm run data:build
 */
import path from "node:path";
import {
  DATASET_FILES,
  type Arc,
  type Character,
  type Crew,
  type DatasetMeta,
  type Fruit,
  type FruitType,
  type Group,
  type Island,
  type Race,
  type Saga,
  type Sea,
  type Ship,
  type Sword,
} from "../../src/lib/data/schema";
import { EXTRA_ID_BASE, type WikiEntry } from "./fetch-wiki";
import { GENERATED_DIR, OVERRIDES_DIR, RAW_DIR, readJson, writeJson } from "./lib/io";
import { cleanValue, collectNamedRefs, linkTargets, parseEntries } from "./lib/wikitext";

// ---------------------------------------------------------------------------
// Données brutes

type ApiCrew = {
  id: number;
  name: string;
  roman_name?: string | null;
  status?: string | null;
  total_prime?: string | null;
  is_yonko?: boolean;
};
type ApiFruit = {
  id: number;
  name: string;
  roman_name?: string | null;
  type?: string | null;
  description?: string | null;
};
type ApiCharacter = {
  id: number;
  name: string;
  size?: string | null;
  age?: string | null;
  bounty?: string | null;
  job?: string | null;
  status?: string | null;
  crew?: ApiCrew | null;
  fruit?: ApiFruit | null;
};
type ApiSaga = { id: number; title: string; saga_number: string };
type ApiArc = { id: number; title: string; saga: ApiSaga };
type ApiEpisode = { id: number; number: string; chapter: string | null; arc?: { id: number } | null };
type ApiIsland = { id: number; name: string; roman_name?: string; sea_name?: string; region_name?: string };
type ApiBoat = { id: number; name: string; roman_name?: string | null; type?: string | null; crew?: ApiCrew | null };
type ApiSword = {
  name: string;
  roman_name?: string | null;
  category?: string | null;
  type?: string | null;
  isDestroy?: boolean;
};

async function loadApi<T>(endpoint: string): Promise<{ fr: T[]; en: T[] }> {
  const [fr, en] = await Promise.all(
    ["fr", "en"].map((lang) => readJson<T[]>(path.join(RAW_DIR, "api", `${endpoint}.${lang}.json`))),
  );
  if (fr.length !== en.length) throw new Error(`${endpoint} : listes fr et en de tailles différentes`);
  return { fr, en };
}

// ---------------------------------------------------------------------------
// Utilitaires

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "oe")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Attribue des identifiants uniques : en cas de collision, on suffixe par l'identifiant API. */
function makeSlugger() {
  const used = new Set<string>();
  return (label: string, apiId: number | string) => {
    let id = slugify(label) || `x-${apiId}`;
    if (used.has(id)) id = `${id}-${apiId}`;
    used.add(id);
    return id;
  };
}

const blank = (s: string | null | undefined): string | null => {
  const t = s?.trim();
  return t && t.toLowerCase() !== "inconnu" && t !== "-" ? t : null;
};

const parseInteger = (s: string | null | undefined): number | null => {
  const digits = s?.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
};

function nameTokens(s: string): Set<string> {
  return new Set(slugify(s).split("-").filter(Boolean));
}

/** Deux entrées de l'API rattachées à la même page wiki désignent-elles le même personnage ? */
function sameName(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if ([...small].every((t) => big.has(t))) return true;
  return editDistance(slugify(a), slugify(b)) <= 2;
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function uniqueStrings(values: (string | null | undefined)[], exclude: string[] = []): string[] {
  const seen = new Set(exclude.map((e) => e.toLowerCase()));
  const out: string[] = [];
  for (const v of values) {
    const t = v?.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lecture des infobox du wiki

function parseDebut(first: string | undefined) {
  if (!first) return null;
  const chapter = first.match(/\[\[Chapter (\d+)/)?.[1];
  const episode = first.match(/\[\[Episode (\d+)/)?.[1];
  if (!chapter && !episode) return null;
  return { chapter: chapter ? Number(chapter) : null, episode: episode ? Number(episode) : null };
}

const SEA_BY_WIKI: Record<string, Sea> = {
  "East Blue": "east-blue",
  "West Blue": "west-blue",
  "North Blue": "north-blue",
  "South Blue": "south-blue",
  "Grand Line": "grand-line",
  "New World": "grand-line",
  "Calm Belt": "calm-belt",
  "Red Line": "red-line",
  "Sky Island": "sky",
};

function parseOrigin(value: string | undefined, refs: Map<string, number>): Character["origin"] {
  if (!value) return null;
  const [seaTitle, place] = linkTargets(value);
  const sea = SEA_BY_WIKI[seaTitle];
  if (!sea) return null;
  const since = parseEntries(value, refs)
    .map((e) => e.since)
    .filter((s): s is number => s !== null);
  return { sea, place: place ?? null, since: since.length ? Math.min(...since) : null };
}

const RACE_BY_CATEGORY: [RegExp, Race][] = [
  [/^(Modified )?Humans$|^Human Hybrids$/, "human"],
  [/Giants$/, "giant"],
  [/^Fish-Men$|^Fish-Man Hybrids$/, "fishman"],
  [/^Merfolk( Hybrids)?$/, "merfolk"],
  [/^Mink Tribe$/, "mink"],
  [/^Dwarves$/, "dwarf"],
  [/^Cyborgs$/, "cyborg"],
  [/^Lunarians$/, "lunarian"],
  [/^Buccaneers$/, "buccaneer"],
  [/^(Birkans|Skypieans|Shandia)$/, "skypiean"],
  [/^Longarm (Tribe|Hybrids)$/, "longarm"],
  [/^Longleg (Tribe|Hybrids)$/, "longleg"],
  [/^Snakeneck (Tribe|Hybrids)$/, "snakeneck"],
  [/^Homies$/, "homie"],
  [/^Clones$/, "clone"],
  [/Animals( with Devil Fruit Abilities)?$/, "animal"],
];

function parseRaces(categories: string[]): Race[] {
  const races = new Set<Race>();
  for (const name of categories) {
    if (/^Fighters Who Use Animals$/.test(name)) continue;
    for (const [pattern, race] of RACE_BY_CATEGORY) if (pattern.test(name)) races.add(race);
  }
  return [...races];
}

/**
 * Sur le wiki, « Non-Canon X » qualifie soit un personnage hors manga, soit un
 * trait hors manga d'un personnage du manga (Zoro est « Non-Canon First Mates »).
 * Un personnage est hors manga quand son genre ou sa race ne sont classés que là.
 */
function isOffCanon(categories: string[]): boolean {
  if (categories.includes("Male Characters") || categories.includes("Female Characters")) return false;
  return categories.some((c) => /^Non-Canon (Male Characters|Female Characters|Humans|Animals|Cyborgs)$/.test(c));
}

const NON_CANON_NOTE = /\b(movie|film|filler|non-canon|anime only|game|novel|live-action|special)\b/i;
const FORMER_NOTE =
  /\b(former|formerly|defected|disbanded|dissolved|resigned|revoked|retired|temporary|temporarily|deceased)\b/i;

/** Affiliations et métiers : « Sun Pirates (former) » → { name, former }. Les mentions hors manga sont ignorées. */
function parseMemberships(value: string | undefined, refs: Map<string, number>) {
  if (!value) return [];
  const out: { name: string; former: boolean; since: number | null }[] = [];
  for (const entry of parseEntries(value, refs)) {
    const notes = [...entry.text.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]).join(" ");
    if (entry.offCanon || NON_CANON_NOTE.test(notes)) continue;
    const name = entry.text.split("(")[0].trim();
    if (!name || out.some((o) => o.name === name)) continue;
    out.push({ name, former: FORMER_NOTE.test(notes), since: entry.since });
  }
  return out;
}

function parseBounties(value: string | undefined, refs: Map<string, number>): Character["bounties"] {
  if (!value) return [];
  const out: Character["bounties"] = [];
  for (const entry of parseEntries(value, refs)) {
    const amount = Number(entry.text.match(/\d[\d,]*/)?.[0].replace(/,/g, ""));
    if (!entry.offCanon && amount > 0) out.push({ amount, since: entry.since });
  }
  return out;
}

function parseEpithets(value: string | undefined, refs: Map<string, number>): Character["epithets"] {
  if (!value) return [];
  const out: Character["epithets"] = [];
  for (const entry of parseEntries(value, refs)) {
    const en = entry.text
      .split("(")[0]
      .replace(/["“”]/g, "")
      .trim();
    if (en && !entry.offCanon && !out.some((o) => o.en === en)) out.push({ en, since: entry.since });
  }
  return out;
}

/** Âge le plus récent : seules les entrées qui donnent un âge exact sont retenues. */
function parseAge(value: string | undefined): number | null {
  if (!value) return null;
  const ages = parseEntries(value, new Map())
    .map((e) => e.text.match(/^(\d{1,4})\b/)?.[1])
    .filter((a): a is string => !!a)
    .map(Number);
  return ages.length ? Math.max(...ages) : null;
}

/** Taille adulte en centimètres (la plus grande des tailles listées). */
function parseHeight(value: string | undefined): number | null {
  if (!value) return null;
  const heights: number[] = [];
  for (const entry of parseEntries(value, new Map())) {
    const m = entry.text.match(/([\d.,]+)\s*(cm|km|m)\b/);
    if (!m) continue;
    const n = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) continue;
    heights.push(m[2] === "cm" ? n : m[2] === "m" ? n * 100 : n * 100_000);
  }
  return heights.length ? Math.max(...heights) : null;
}

/** Noms des éditions anglaises (« Dogstorm », un par ligne), sans leurs annotations entre parenthèses. */
function englishNames(value: string | undefined): string[] {
  return cleanValue(value ?? "")
    .split("\n")
    .map((name) => name.replace(/\(.*?\)/g, "").trim())
    .filter(Boolean);
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\//g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Construction

const FRUIT_TYPE_BY_API: Record<string, FruitType> = {
  paramecia: "paramecia",
  logia: "logia",
  zoan: "zoan",
  "zoan antique": "zoan-ancient",
  "zoan mythique": "zoan-mythical",
  smile: "smile",
  clone: "artificial",
};

function buildCrews(api: { fr: ApiCrew[]; en: ApiCrew[] }) {
  const slugger = makeSlugger();
  const idByApi = new Map<number, string>();
  const crews: Crew[] = api.fr.map((fr, i) => {
    const en = api.en[i];
    // Les noms anglais de l'API sont des traductions approximatives : le nom japonais est plus stable
    const id = slugger(blank(fr.roman_name) ?? fr.name, fr.id);
    idByApi.set(fr.id, id);
    return {
      id,
      apiId: fr.id,
      name: { fr: fr.name.trim(), en: en.name.trim() },
      romaji: blank(fr.roman_name),
      isYonko: !!fr.is_yonko,
      totalBounty: parseInteger(blank(fr.total_prime)),
      status: blank(fr.status),
    };
  });
  return { crews, idByApi };
}

/**
 * Type d'un fruit d'après sa fiche wiki, plus fiable que l'API. Un fruit dont la
 * vraie nature a été révélée après coup (celui de Luffy) liste ses deux types :
 * le plus précis l'emporte.
 */
function parseWikiFruitType(value: string | undefined): FruitType | null {
  const text = cleanValue(value ?? "");
  if (/Mythical Zoan/i.test(text)) return "zoan-mythical";
  if (/Ancient Zoan/i.test(text)) return "zoan-ancient";
  if (/Artificial|SMILE/i.test(text)) return null;
  return (["zoan", "logia", "paramecia"] as const).find((type) => new RegExp(type, "i").test(text)) ?? null;
}

function buildFruits(api: { fr: ApiFruit[]; en: ApiFruit[] }, wiki: Record<number, WikiEntry>) {
  const slugger = makeSlugger();
  const idByApi = new Map<number, string>();
  const byWikiTitle = new Map<string, Fruit>();
  const fruits: Fruit[] = [];

  api.fr.forEach((fr, i) => {
    const en = api.en[i];
    const entry = wiki[fr.id];
    const type = parseWikiFruitType(entry?.params.type) ?? FRUIT_TYPE_BY_API[fr.type?.trim().toLowerCase() ?? ""];
    // L'API contient quelques entrées vides ou sans type exploitable
    if (!type || slugify(fr.name) === "fruit") return;

    const duplicate = entry && byWikiTitle.get(entry.title);
    if (duplicate) {
      idByApi.set(fr.id, duplicate.id);
      return;
    }

    const fruit: Fruit = {
      id: slugger(entry?.title ?? blank(fr.roman_name) ?? en.name, fr.id),
      apiId: fr.id,
      wikiTitle: entry?.title ?? null,
      name: { fr: fr.name.trim(), en: entry ? cleanTitle(entry.title) : en.name.trim() },
      romaji: blank(fr.roman_name),
      type,
      description: blank(fr.description),
      debut: parseDebut(entry?.params.first),
      userIds: [],
    };
    idByApi.set(fr.id, fruit.id);
    if (entry) byWikiTitle.set(entry.title, fruit);
    fruits.push(fruit);
  });

  // Titre de page wiki (ou titre redirigé vers elle) → identifiant du fruit
  const idByWikiTitle = new Map<string, string>();
  for (const [apiId, entry] of Object.entries(wiki)) {
    const id = idByApi.get(Number(apiId));
    if (!id) continue;
    idByWikiTitle.set(entry.title, id);
    idByWikiTitle.set(entry.requested, id);
  }
  return { fruits, idByApi, idByWikiTitle };
}

/** Notoriété déduite de l'article wiki : découpé en onglets ou long = personnage important. */
function tierOf(entry: WikiEntry | undefined): number {
  if (!entry) return 4;
  if (entry.tabbed || entry.size >= 50_000) return 1;
  if (entry.size >= 25_000) return 2;
  return entry.size >= 10_000 ? 3 : 4;
}

type CharacterOverride = Partial<Omit<Character, "name">> & { name?: Partial<Character["name"]> };

function buildCharacters(
  api: { fr: ApiCharacter[]; en: ApiCharacter[] },
  wiki: Record<number, WikiEntry>,
  crewIdByApi: Map<number, string>,
  fruitIdByApi: Map<number, string>,
  fruitIdByWikiTitle: Map<string, string>,
  overrides: Record<string, CharacterOverride>,
) {
  const slugger = makeSlugger();
  const byWikiTitle = new Map<string, Character[]>();
  const characters: Character[] = [];
  const verifiedFruitIds = new Set(fruitIdByWikiTitle.values());

  // Pages du wiki qui décrivent plusieurs personnages à la fois (« Mozu and Kiwi »)
  const titleUses = new Map<string, number>();
  for (const c of api.en) {
    const title = wiki[c.id]?.title;
    if (title) titleUses.set(title, (titleUses.get(title) ?? 0) + 1);
  }

  api.fr.forEach((fr, i) => {
    const en = api.en[i];
    const entry: WikiEntry | undefined = wiki[fr.id];
    const [frName, ...frAliases] = fr.name.split(" / ").map((s) => s.trim().replace(/ D /g, " D. "));

    // Doublon de l'API : même page wiki et même nom
    const twin = entry && byWikiTitle.get(entry.title)?.find((c) => sameName(c.name.fr, frName));
    if (twin) {
      twin.aliases = uniqueStrings([...twin.aliases, frName, ...frAliases], [twin.name.fr]);
      twin.crewId ??= fr.crew ? (crewIdByApi.get(fr.crew.id) ?? null) : null;
      twin.fruitId ??= fr.fruit ? (fruitIdByApi.get(fr.fruit.id) ?? null) : null;
      return;
    }

    const params = entry?.params ?? {};
    const categories = entry?.categories ?? [];
    const refs = collectNamedRefs(params);
    const offCanon = isOffCanon(categories);
    const traits = offCanon ? categories.map((c) => c.replace(/^Non-Canon /, "")) : categories;
    const has = (name: string) => traits.includes(name);

    // Une page partagée par plusieurs personnages ne donne pas le nom de chacun
    const ownPage = entry && titleUses.get(entry.title) === 1;
    const enName = ownPage ? cleanTitle(entry.title) : en.name.split(" / ")[0].trim();
    const debut = parseDebut(params.first);

    // Les fruits attribués par l'API comportent des erreurs : la fiche wiki du
    // personnage fait foi quand elle existe.
    const apiFruitId = fr.fruit ? (fruitIdByApi.get(fr.fruit.id) ?? null) : null;
    const wikiFruitTitle = linkTargets(params.dfname ?? "")[0];
    // Fruit de l'API non rattaché à une page wiki : rien ne le contredit, on le garde
    const unverifiedApiFruit = apiFruitId && !verifiedFruitIds.has(apiFruitId) ? apiFruitId : null;
    const fruitId = !ownPage
      ? apiFruitId
      : wikiFruitTitle
        ? (fruitIdByWikiTitle.get(wikiFruitTitle) ?? unverifiedApiFruit)
        : params.dfname
          ? unverifiedApiFruit
          : null;

    const character: Character = {
      id: slugger(enName, fr.id),
      apiId: fr.id,
      wikiTitle: entry?.title ?? null,
      name: { fr: frName, en: enName },
      aliases: uniqueStrings(
        [...frAliases, enName, ...en.name.split(" / "), ...(ownPage ? englishNames(params.ename) : [])],
        [frName],
      ),
      canon: debut?.chapter != null && !offCanon,
      tier: tierOf(entry),
      debut,
      gender: has("Male Characters") ? "male" : has("Female Characters") ? "female" : null,
      races: parseRaces(traits),
      origin: parseOrigin(params.origin, refs),
      age: (ownPage ? parseAge(params.age) : null) ?? parseInteger(blank(fr.age)),
      height: (ownPage ? parseHeight(params.height) : null) ?? parseInteger(blank(fr.size)),
      status: has("Deceased Characters")
        ? "deceased"
        : /^(décédé|mort)/i.test(fr.status ?? "")
          ? "deceased"
          : /^vivant/i.test(fr.status ?? "")
            ? "alive"
            : "unknown",
      bounties: ownPage ? parseBounties(params.bounty, refs) : [],
      epithets: ownPage ? parseEpithets(params.epithet, refs) : [],
      affiliations: parseMemberships(params.affiliation, refs),
      occupations: parseMemberships(params.occupation, refs),
      crewId: fr.crew ? (crewIdByApi.get(fr.crew.id) ?? null) : null,
      job: blank(fr.job),
      fruitId,
      haki: {
        observation: has("Observation Haki Users"),
        armament: has("Armament Haki Users"),
        conqueror: has("Supreme King Haki Users"),
      },
    };

    // Sans historique wiki, on garde la prime de l'API
    const apiBounty = parseInteger(blank(fr.bounty));
    if (!character.bounties.length && apiBounty !== null) {
      character.bounties = [{ amount: apiBounty, since: null }];
    }

    const override = overrides[character.id];
    if (override) {
      // Les autres noms s'ajoutent à ceux trouvés par l'import ; le reste les remplace
      const { name, aliases = [], ...rest } = override;
      Object.assign(character, rest);
      character.name = { ...character.name, ...name };
      character.aliases = uniqueStrings([...character.aliases, ...aliases], [character.name.fr]);
    }

    if (entry) byWikiTitle.set(entry.title, [...(byWikiTitle.get(entry.title) ?? []), character]);
    characters.push(character);
  });

  const unknownOverrides = Object.keys(overrides).filter((id) => !characters.some((c) => c.id === id));
  if (unknownOverrides.length) {
    throw new Error(`data/overrides/characters.json : identifiants inconnus : ${unknownOverrides.join(", ")}`);
  }
  return characters;
}

/** `en` : titre anglais, sans le mot « Arc » ; celui de l'API est une traduction automatique. */
type ArcOverride = { firstChapter?: number; kind?: "cover" | "filler"; en?: string };

/** Numéros de chapitre cités par un épisode (« Chap 2-3 », « Ch. 1132 »...). */
function episodeChapters(value: string | null): number[] {
  return [...(value ?? "").matchAll(/\d+/g)].map((m) => Number(m[0]));
}

function buildArcs(
  api: { fr: ApiArc[]; en: ApiArc[] },
  episodes: ApiEpisode[],
  overrides: Record<string, ArcOverride>,
  latestChapter: number,
) {
  const sagaSlugger = makeSlugger();
  const sagaIdByApi = new Map<number, string>();
  const sagas: Saga[] = [];
  api.fr.forEach((fr, i) => {
    if (sagaIdByApi.has(fr.saga.id)) return;
    const id = sagaSlugger(api.en[i].saga.title, fr.saga.id);
    sagaIdByApi.set(fr.saga.id, id);
    sagas.push({
      id,
      number: Number(fr.saga.saga_number),
      title: { fr: fr.saga.title.trim(), en: api.en[i].saga.title.trim() },
    });
  });

  const starts = api.fr
    .map((arc) => overrides[arc.id]?.firstChapter)
    .filter((c): c is number => c !== undefined)
    .sort((a, b) => a - b);

  const numbered = episodes
    .map((e) => ({ number: parseInteger(e.number) ?? 0, arcId: e.arc?.id, chapters: episodeChapters(e.chapter) }))
    .sort((a, b) => a.number - b.number);
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  /** Plus longue série d'épisodes rapprochés : écarte les rattachements isolés, erronés dans l'API. */
  const mainRun = (numbers: number[], maxGap: number) => {
    let best: number[] = [];
    let run: number[] = [];
    for (const n of numbers) {
      if (run.length && n - run[run.length - 1] > maxGap) run = [];
      run.push(n);
      if (run.length > best.length) best = run;
    }
    return best;
  };

  const arcSlugger = makeSlugger();
  const arcs: Arc[] = api.fr.map((fr, i) => {
    const override = overrides[fr.id];
    if (!override) throw new Error(`data/overrides/arcs.json : arc ${fr.id} (${fr.title}) non renseigné`);

    const first = override.firstChapter;
    const next = first === undefined ? undefined : starts[starts.indexOf(first) + 1];
    const last = next !== undefined ? next - 1 : latestChapter;

    // Le rattachement épisode → arc de l'API est peu fiable. Pour un arc du manga, on
    // se fie aux chapitres adaptés par chaque épisode ; sinon, à la plus longue série
    // d'épisodes consécutifs que l'API lui attribue.
    const numbers =
      first !== undefined
        ? mainRun(
            numbered
              .filter((e) => e.chapters.length && median(e.chapters) >= first && median(e.chapters) <= last)
              .map((e) => e.number),
            20,
          )
        : mainRun(
            numbered.filter((e) => e.arcId === fr.id).map((e) => e.number),
            1,
          );

    return {
      id: arcSlugger(api.en[i].title.replace(/\barc\b/gi, ""), fr.id),
      number: fr.id,
      title: { fr: fr.title.trim(), en: override.en ? `${override.en} Arc` : api.en[i].title.trim() },
      sagaId: sagaIdByApi.get(fr.saga.id)!,
      kind: first !== undefined ? "manga" : (override.kind ?? "filler"),
      chapters: first !== undefined ? { first, last } : null,
      episodes: numbers.length ? { first: Math.min(...numbers), last: Math.max(...numbers) } : null,
    };
  });
  return { sagas, arcs };
}

async function main() {
  const [apiChars, apiFruits, apiCrews, apiArcs, apiEpisodes, apiChapters, apiIslands, apiBoats, apiSwords] =
    await Promise.all([
      loadApi<ApiCharacter>("characters"),
      loadApi<ApiFruit>("fruits"),
      loadApi<ApiCrew>("crews"),
      loadApi<ApiArc>("arcs"),
      loadApi<ApiEpisode>("episodes"),
      loadApi<{ id: number }>("chapters"),
      loadApi<ApiIsland>("locates"),
      loadApi<ApiBoat>("boats"),
      loadApi<ApiSword>("swords"),
    ]);
  const wikiChars = await readJson<Record<number, WikiEntry>>(path.join(RAW_DIR, "wiki/characters.json"));
  const wikiFruits = await readJson<Record<number, WikiEntry>>(path.join(RAW_DIR, "wiki/fruits.json"));

  const withoutComment = <T>({ _comment, ...rest }: Record<string, T> & { _comment?: unknown }) => {
    void _comment;
    return rest as Record<string, T>;
  };
  const characterOverrides = withoutComment(
    await readJson<Record<string, CharacterOverride>>(path.join(OVERRIDES_DIR, "characters.json")),
  );
  const arcOverrides = withoutComment(
    await readJson<Record<string, ArcOverride>>(path.join(OVERRIDES_DIR, "arcs.json")),
  );
  const spoilerOverrides = await readJson<{ animeCutoffChapter: number | null }>(
    path.join(OVERRIDES_DIR, "spoilers.json"),
  );

  const { dropCharacters } = await readJson<{ dropCharacters: string[] }>(path.join(OVERRIDES_DIR, "api-fixes.json"));
  const missingDrops = dropCharacters.filter((name) => !apiChars.fr.some((c) => c.name === name));
  if (missingDrops.length) {
    throw new Error(`data/overrides/api-fixes.json : noms absents de l'API : ${missingDrops.join(", ")}`);
  }
  const kept = apiChars.fr.map((c) => !dropCharacters.includes(c.name));
  apiChars.fr = apiChars.fr.filter((_, i) => kept[i]);
  apiChars.en = apiChars.en.filter((_, i) => kept[i]);

  // Personnages absents de l'API, décrits uniquement par leur page wiki
  const extras = await readJson<{ characters: { name: string }[] }>(
    path.join(OVERRIDES_DIR, "extra-characters.json"),
  );
  extras.characters.forEach((extra, i) => {
    const character = { id: EXTRA_ID_BASE + i, name: extra.name };
    apiChars.fr.push(character);
    apiChars.en.push(character);
  });

  const { crews, idByApi: crewIdByApi } = buildCrews(apiCrews);
  const { fruits, idByApi: fruitIdByApi, idByWikiTitle: fruitIdByWikiTitle } = buildFruits(apiFruits, wikiFruits);
  const characters = buildCharacters(
    apiChars,
    wikiChars,
    crewIdByApi,
    fruitIdByApi,
    fruitIdByWikiTitle,
    characterOverrides,
  );

  // Utilisateurs des fruits ; à défaut de fiche wiki, un fruit débute avec son premier utilisateur
  for (const fruit of fruits) {
    const users = characters.filter((c) => c.fruitId === fruit.id);
    fruit.userIds = users.map((c) => c.id);
    if (!fruit.debut) {
      const chapters = users.map((c) => c.debut?.chapter).filter((c): c is number => !!c);
      if (chapters.length) fruit.debut = { chapter: Math.min(...chapters), episode: null };
    }
  }

  // Repères de publication
  const sinceValues = characters.flatMap((c) => [
    c.debut?.chapter,
    c.origin?.since,
    ...c.bounties.map((b) => b.since),
    ...c.epithets.map((e) => e.since),
    ...c.affiliations.map((a) => a.since),
    ...c.occupations.map((o) => o.since),
  ]);
  const latestChapter = Math.max(
    ...apiChapters.fr.map((c) => c.id),
    ...sinceValues.filter((s): s is number => typeof s === "number"),
  );
  const adapted = apiEpisodes.fr
    .map((e) => ({ number: parseInteger(e.number) ?? 0, chapters: episodeChapters(e.chapter) }))
    .filter((e) => e.chapters.length)
    .sort((a, b) => a.number - b.number);
  const lastAdapted = adapted[adapted.length - 1];
  const animeCutoffChapter = spoilerOverrides.animeCutoffChapter ?? Math.max(...lastAdapted.chapters);
  const latestEpisode = Math.max(...apiEpisodes.fr.map((e) => parseInteger(e.number) ?? 0));

  const { sagas, arcs } = buildArcs(apiArcs, apiEpisodes.fr, arcOverrides, latestChapter);

  const islandSlugger = makeSlugger();
  const islands: Island[] = apiIslands.fr.map((fr, i) => ({
    id: islandSlugger(apiIslands.en[i].name, fr.id),
    apiId: fr.id,
    name: { fr: fr.name.trim(), en: apiIslands.en[i].name.trim() },
    romaji: blank(fr.roman_name),
    sea: blank(fr.sea_name),
    region: blank(fr.region_name),
  }));

  const shipSlugger = makeSlugger();
  const ships: Ship[] = apiBoats.fr.map((fr, i) => ({
    id: shipSlugger(apiBoats.en[i].name, fr.id),
    apiId: fr.id,
    name: { fr: fr.name.trim(), en: apiBoats.en[i].name.trim() },
    romaji: blank(fr.roman_name),
    type: blank(fr.type),
    crewId: fr.crew ? (crewIdByApi.get(fr.crew.id) ?? null) : null,
  }));

  const swordSlugger = makeSlugger();
  const swords: Sword[] = apiSwords.fr.map((fr, i) => ({
    id: swordSlugger(apiSwords.en[i].name, i),
    name: { fr: fr.name.trim(), en: apiSwords.en[i].name.trim() },
    romaji: blank(fr.roman_name),
    category: blank(fr.category),
    type: blank(fr.type),
    destroyed: !!fr.isDestroy,
  }));

  const groupOverrides = await readJson<{ groups: (Omit<Group, "memberIds"> & { members: string[] })[] }>(
    path.join(OVERRIDES_DIR, "groups.json"),
  );
  const characterIds = new Set(characters.filter((c) => c.canon).map((c) => c.id));
  const groups: Group[] = groupOverrides.groups.map(({ members, ...group }) => {
    const unknown = members.filter((id) => !characterIds.has(id));
    if (unknown.length) {
      throw new Error(`data/overrides/groups.json : groupe ${group.id}, personnages inconnus : ${unknown.join(", ")}`);
    }
    return { ...group, memberIds: members };
  });

  const meta: DatasetMeta = {
    latestChapter,
    latestEpisode,
    animeCutoffChapter,
    counts: {
      characters: characters.length,
      canonCharacters: characters.filter((c) => c.canon).length,
      fruits: fruits.length,
      crews: crews.length,
      sagas: sagas.length,
      arcs: arcs.length,
      islands: islands.length,
      ships: ships.length,
      swords: swords.length,
      groups: groups.length,
    },
    sources: [
      { name: "One Piece API", url: "https://api-onepiece.com/", license: "Données ouvertes" },
      { name: "One Piece Wiki", url: "https://onepiece.fandom.com/", license: "CC BY-SA 3.0" },
      { name: "AniList", url: "https://anilist.co/", license: "portraits des personnages" },
    ],
  };

  const dataset = { characters, fruits, crews, sagas, arcs, islands, ships, swords, groups, meta };
  for (const [name, schema] of Object.entries(DATASET_FILES)) {
    const parsed = schema.safeParse(dataset[name as keyof typeof dataset]);
    if (!parsed.success) {
      console.error(parsed.error.issues.slice(0, 20));
      throw new Error(`${name}.json ne respecte pas son schéma`);
    }
    await writeJson(path.join(GENERATED_DIR, `${name}.json`), parsed.data);
  }

  console.log(meta.counts);
  console.log(
    `Dernier chapitre : ${latestChapter} · dernier épisode : ${latestEpisode} · ` +
      `limite du mode anime : chapitre ${animeCutoffChapter}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
