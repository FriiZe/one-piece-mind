/**
 * Enrichit les personnages et les fruits de l'API avec les infobox du wiki
 * One Piece (onepiece.fandom.com, contenu sous licence CC BY-SA) : première
 * apparition, surnom, origine, historique des primes...
 *
 * Écrit data/raw/wiki/{characters,fruits}.json, indexés par identifiant API.
 * Usage : npm run data:fetch-wiki
 */
import path from "node:path";
import { OVERRIDES_DIR, RAW_DIR, chunk, fetchJson, readJson, sleep, writeJson } from "./lib/io";
import { extractTemplate, linkTargets } from "./lib/wikitext";

const WIKI_API = "https://onepiece.fandom.com/api.php";
/** Identifiants attribués aux personnages de data/overrides/extra-characters.json. */
export const EXTRA_ID_BASE = 100_000;
const BATCH = 50;

type WikiPage = {
  title: string;
  missing?: boolean;
  revisions?: { slots: { main: { content: string } } }[];
};
type QueryResponse = {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: WikiPage[];
    search?: { title: string }[];
  };
};

export type WikiEntry = {
  title: string;
  /** "title" : titre déduit du nom ; "search" : trouvé par la recherche du wiki. */
  matchedBy: "title" | "search";
  /** Titre demandé, avant redirection (peut différer de `title`). */
  requested: string;
  params: Record<string, string>;
  /** Catégories de la page (genre, race, haki, mer d'origine...). */
  categories: string[];
  /** Longueur de l'article, en caractères : indice de l'importance du personnage. */
  size: number;
  /** Article découpé en onglets, ce que le wiki réserve aux personnages majeurs. */
  tabbed: boolean;
};

type Item = { id: number; name: string; candidates: string[] };

/** Titre demandé → contenu de la page finale (redirections suivies). */
async function fetchPages(titles: string[]): Promise<Map<string, { title: string; content: string }>> {
  const out = new Map<string, { title: string; content: string }>();
  for (const batch of chunk([...new Set(titles)], BATCH)) {
    const url =
      `${WIKI_API}?action=query&prop=revisions&rvprop=content&rvslots=main&format=json` +
      `&formatversion=2&redirects=1&titles=${encodeURIComponent(batch.join("|"))}`;
    const res = await fetchJson<QueryResponse>(url);
    const hop = new Map<string, string>();
    for (const n of res.query?.normalized ?? []) hop.set(n.from, n.to);
    for (const r of res.query?.redirects ?? []) hop.set(r.from, r.to);
    const pages = new Map<string, string>();
    for (const page of res.query?.pages ?? []) {
      const content = page.revisions?.[0]?.slots.main.content;
      if (!page.missing && content) pages.set(page.title, content);
    }
    for (const requested of batch) {
      let title = requested;
      for (let i = 0; i < 5 && hop.has(title); i++) title = hop.get(title)!;
      const content = pages.get(title);
      if (content) out.set(requested, { title, content });
    }
    await sleep(250);
  }
  return out;
}

/**
 * Infobox d'une page. Les personnages majeurs rangent la leur dans un modèle
 * « <Nom> Tabs Top » : on renvoie alors le titre de ce modèle à aller chercher.
 */
function readInfobox(content: string, template: string) {
  const params = extractTemplate(content, template);
  if (params) return { params };
  const tabs = content.match(/\{\{\s*([^{}|]+? Tabs Top)\s*\}\}/);
  return tabs ? { tabsTemplate: `Template:${tabs[1].trim()}` } : {};
}

function readCategories(content: string): string[] {
  return [...content.matchAll(/\[\[Category:([^\]|]+)/g)].map((m) => m[1].trim());
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
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

/** Le titre trouvé par la recherche désigne-t-il bien la même entité que le nom API ? */
function sameEntity(name: string, title: string): boolean {
  const a = normalize(name);
  const b = normalize(title.replace(/\(.*?\)/g, ""));
  if (a.replace(/ /g, "") === b.replace(/ /g, "")) return true;
  const ta = new Set(a.split(" "));
  const tb = new Set(b.split(" "));
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if (small.size >= 2 && [...small].every((t) => big.has(t))) return true;
  return Math.min(a.length, b.length) >= 6 && levenshtein(a, b) <= 2;
}

async function searchTitles(query: string): Promise<string[]> {
  const url =
    `${WIKI_API}?action=query&list=search&srnamespace=0&srlimit=3&format=json&formatversion=2` +
    `&srsearch=${encodeURIComponent(query)}`;
  const res = await fetchJson<QueryResponse>(url);
  await sleep(150);
  return (res.query?.search ?? []).map((s) => s.title);
}

/** Sous-pages d'onglets (« X/History »...) : même infobox que la page mère, à ne pas retenir. */
const SECTION_SUBPAGE = /\/(Abilities and Powers|History|Gallery|Personality|Relationships|Misc\.?)(\/|$)/;

async function enrich(
  items: Item[],
  template: string,
  { search = true }: { search?: boolean } = {},
): Promise<Record<number, WikiEntry>> {
  const result: Record<number, WikiEntry> = {};

  // 1. Titres déduits du nom
  const pages = await fetchPages(items.flatMap((i) => i.candidates));
  const pendingTabs = new Map<
    string,
{ item: Item; title: string; matchedBy: WikiEntry["matchedBy"]; requested: string; categories: string[]; size: number }
  >();

  const tryPage = (item: Item, requested: string, matchedBy: WikiEntry["matchedBy"], source = pages) => {
    const page = source.get(requested);
    if (!page) return false;
    const box = readInfobox(page.content, template);
    const categories = readCategories(page.content);
    const size = page.content.length;
    if (box.params) {
      result[item.id] = { title: page.title, matchedBy, requested, params: box.params, categories, size, tabbed: false };
      return true;
    }
    if (box.tabsTemplate) {
      pendingTabs.set(box.tabsTemplate, { item, title: page.title, matchedBy, requested, categories, size });
      return true;
    }
    return false;
  };

  const unmatched: Item[] = [];
  for (const item of items) {
    if (!item.candidates.some((c) => tryPage(item, c, "title"))) unmatched.push(item);
  }

  // 2. Recherche du wiki pour les noms sans page directe
  const searchHits = new Map<Item, string[]>();
  for (const item of search ? unmatched : []) {
    const titles = (await searchTitles(item.name)).filter(
      (t) => !SECTION_SUBPAGE.test(t) && sameEntity(item.name, t),
    );
    if (titles.length) searchHits.set(item, titles);
  }
  const searchPages = await fetchPages([...searchHits.values()].flat());
  for (const [item, titles] of searchHits) {
    titles.some((t) => tryPage(item, t, "search", searchPages));
  }

  // 3. Infobox rangées dans un modèle « Tabs Top »
  const tabsPages = await fetchPages([...pendingTabs.keys()]);
  for (const [tabsTitle, { item, title, matchedBy, requested, categories, size }] of pendingTabs) {
    const params = extractTemplate(tabsPages.get(tabsTitle)?.content ?? "", template);
    if (params) result[item.id] = { title, matchedBy, requested, params, categories, size, tabbed: true };
  }

  return result;
}

function characterCandidates(name: string, aliases: Record<string, string>): string[] {
  if (aliases[name]) return [aliases[name]];
  const variants = name.split(" / ").flatMap((n) => {
    const base = n.trim().replace(/’/g, "'");
    const words = base.split(" ");
    return [
      base,
      base.replace(/ D /g, " D. "),
      // Nom de famille en premier sur le wiki (« Kozuki Oden »)
      ...(words.length === 2 ? [`${words[1]} ${words[0]}`] : []),
    ];
  });
  return [...new Set(variants)];
}

function stripMacrons(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").normalize("NFC");
}

function fruitCandidates(romanName: string | null, userFruitTitles: string[]): string[] {
  const out = [...userFruitTitles];
  if (romanName) {
    const plain = stripMacrons(romanName);
    out.push(plain, plain.replace(/,?\s*mod[eè]l?[eu]?\s*:?\s+/i, ", Model: "));
  }
  return [...new Set(out)];
}

function report(label: string, items: Item[], result: Record<number, WikiEntry>) {
  const missing = items.filter((i) => !result[i.id]);
  const bySearch = Object.values(result).filter((e) => e.matchedBy === "search").length;
  console.log(
    `${label} : ${items.length - missing.length}/${items.length} enrichis ` +
      `(dont ${bySearch} via la recherche), ${missing.length} sans fiche`,
  );
}

async function main() {
  const { _comment, ...aliases } = await readJson<Record<string, string>>(
    path.join(OVERRIDES_DIR, "wiki-titles.json"),
  );
  void _comment;

  const characters = await readJson<{ id: number; name: string; fruit?: { id: number } | null }[]>(
    path.join(RAW_DIR, "api/characters.en.json"),
  );
  const extras = await readJson<{ characters: { name: string; wikiTitle: string }[] }>(
    path.join(OVERRIDES_DIR, "extra-characters.json"),
  );
  const charItems = [
    ...characters.map((c) => ({ id: c.id, name: c.name, candidates: characterCandidates(c.name, aliases) })),
    ...extras.characters.map((c, i) => ({ id: EXTRA_ID_BASE + i, name: c.name, candidates: [c.wikiTitle] })),
  ];
  const charResult = await enrich(charItems, "Char Box");
  await writeJson(path.join(RAW_DIR, "wiki/characters.json"), charResult);
  report("Personnages", charItems, charResult);

  // Le titre wiki d'un fruit se lit de préférence dans la fiche de son utilisateur :
  // les noms romanisés de l'API ne suivent pas les titres du wiki pour les Zoan.
  const fruitTitlesFromUsers = new Map<number, string[]>();
  for (const c of characters) {
    const dfname = charResult[c.id]?.params.dfname;
    if (!c.fruit?.id || !dfname) continue;
    const titles = fruitTitlesFromUsers.get(c.fruit.id) ?? [];
    titles.push(...linkTargets(dfname).slice(0, 1));
    fruitTitlesFromUsers.set(c.fruit.id, titles);
  }

  const fruits = await readJson<{ id: number; name: string; roman_name: string | null }[]>(
    path.join(RAW_DIR, "api/fruits.en.json"),
  );
  const fruitItems = fruits.map((f) => ({
    id: f.id,
    name: f.roman_name || f.name,
    candidates: fruitCandidates(f.roman_name, fruitTitlesFromUsers.get(f.id) ?? []),
  }));
  const fruitResult = await enrich(fruitItems, "Devil Fruit Box", { search: false });
  await writeJson(path.join(RAW_DIR, "wiki/fruits.json"), fruitResult);
  report("Fruits", fruitItems, fruitResult);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
