/**
 * Récupère les portraits officiels de l'anime et les rattache aux personnages
 * du jeu de données. Deux sources publiques, dans l'ordre :
 *
 *   1. AniList (API GraphQL) ;
 *   2. MyAnimeList, par l'API Jikan, pour les personnages qu'AniList n'a pas :
 *      sa liste est bien plus longue (lieutenants, famille Charlotte…).
 *
 * (Le One Piece Wiki, source du reste des données, protège ses images contre
 * les téléchargements automatisés : on ne passe pas outre.)
 *
 * Les images sont converties en WebP et rangées sous un nom qui ne révèle pas
 * le personnage : un jeu ne doit pas donner sa réponse dans l'adresse de
 * l'image. L'inventaire est écrit dans data/generated/images.json, avec la
 * source de chaque portrait (`anilist:<id>` ou `mal:<id>`).
 *
 * Usage : npm run images:fetch            télécharge ce qui manque
 *         npm run images:fetch -- --dry   rapproche les noms sans rien télécharger
 *         npm run images:fetch -- --refresh   redemande les listes aux deux API
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { imageManifestSchema, type Character, type ImageManifest } from "../../src/lib/data/schema";
import {
  GENERATED_DIR,
  OVERRIDES_DIR,
  RAW_DIR,
  ROOT,
  USER_AGENT,
  readJson,
  readJsonOr,
  sleep,
  writeJson,
} from "../data/lib/io";

const ANILIST_API = "https://graphql.anilist.co";
const JIKAN_API = "https://api.jikan.moe/v4";
/** One Piece (série animée) : sur AniList, puis sur MyAnimeList. */
const ANILIST_MEDIA_ID = 21;
const MAL_ANIME_ID = 21;
const PORTRAIT_WIDTH = 360;

/** Une fiche de personnage avec image, quelle que soit l'API dont elle vient. */
type Candidate = {
  /** `anilist` ou `mal`. */
  source: string;
  id: number;
  name: string;
  url: string;
};

type AniListCharacter = {
  id: number;
  name: { full: string | null; first: string | null; last: string | null };
  image: { large: string | null };
};

type JikanCharacter = {
  character: { mal_id: number; name: string; images: { jpg: { image_url: string | null } } };
};

export function hashedName(kind: string, key: string): string {
  return createHash("sha1").update(`opm:${kind}:${key}`).digest("hex").slice(0, 12);
}

const ANILIST_QUERY = `query ($page: Int) {
  Media(id: ${ANILIST_MEDIA_ID}, type: ANIME) {
    characters(page: $page, perPage: 50, sort: [ROLE, RELEVANCE, ID]) {
      pageInfo { hasNextPage }
      nodes { id name { full first last } image { large } }
    }
  }
}`;

async function fetchAniListCharacters(): Promise<AniListCharacter[]> {
  const all: AniListCharacter[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { page } }),
    });
    if (!res.ok) throw new Error(`AniList : HTTP ${res.status}`);
    const json = (await res.json()) as {
      data: { Media: { characters: { pageInfo: { hasNextPage: boolean }; nodes: AniListCharacter[] } } };
    };
    const { pageInfo, nodes } = json.data.Media.characters;
    all.push(...nodes);
    if (!pageInfo.hasNextPage) break;
    // L'API limite à 30 requêtes par minute
    await sleep(2200);
  }
  return all;
}

/** Jikan renvoie tous les personnages d'un anime d'un coup, sans pagination. */
async function fetchJikanCharacters(): Promise<JikanCharacter[]> {
  const res = await fetch(`${JIKAN_API}/anime/${MAL_ANIME_ID}/characters`, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Jikan : HTTP ${res.status}`);
  const json = (await res.json()) as { data: JikanCharacter[] };
  return json.data;
}

/** Les listes sont gardées en cache : on ne redemande aux API qu'avec `--refresh`. */
async function cached<T>(file: string, refresh: boolean, load: () => Promise<T>): Promise<T | null> {
  const target = path.join(RAW_DIR, file);
  if (!refresh) {
    const known = await readJsonOr<T | null>(target, null);
    if (known) return known;
  }
  try {
    const data = await load();
    await writeJson(target, data);
    return data;
  } catch (error) {
    console.warn(`${file} : liste indisponible, on continue sans (${(error as Error).message})`);
    return null;
  }
}

/** AniList masque les images absentes derrière une image par défaut ; MyAnimeList, derrière un point d'interrogation. */
const isPlaceholder = (url: string) => /\/default\.|questionmark|\/icon\/na/.test(url);

function aniListCandidates(characters: AniListCharacter[]): Candidate[] {
  return characters
    .filter((c) => c.image.large && !isPlaceholder(c.image.large))
    .map((c) => ({ source: "anilist", id: c.id, name: c.name.full ?? "", url: c.image.large! }));
}

function jikanCandidates(characters: JikanCharacter[]): Candidate[] {
  return characters
    .map((c) => c.character)
    .filter((c) => c.images.jpg.image_url && !isPlaceholder(c.images.jpg.image_url))
    .map((c) => ({ source: "mal", id: c.mal_id, name: c.name, url: c.images.jpg.image_url! }));
}

/**
 * Clé de rapprochement : les mots du nom, sans ordre (AniList écrit « Luffy Monkey »,
 * MyAnimeList « Monkey D., Luffy »), sans initiale isolée.
 */
function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1)
    .sort()
    .join(" ");
}

/** La même, à la transcription des voyelles longues près (« Ryuma » / « Ryuuma », « Rakuyo » / « Rakuyou »). */
const looseKey = (name: string) => nameKey(name).replace(/ou|oo/g, "o").replace(/uu/g, "u");

/** Identifiants forcés d'un fichier d'overrides : personnage du jeu → fiche de l'API. */
async function readForced(file: string): Promise<Record<string, number>> {
  const { _comment, ...forced } = await readJsonOr<Record<string, number | string>>(path.join(OVERRIDES_DIR, file), {});
  void _comment;
  return forced as Record<string, number>;
}

/**
 * Rapproche les personnages encore sans portrait des fiches d'une source. Les
 * identifiants forcés passent d'abord ; puis un nom porté par une seule fiche ;
 * puis la variante de transcription. Une fiche ne sert qu'une fois.
 */
function match(
  characters: Character[],
  candidates: Candidate[],
  forced: Record<string, number>,
  matches: Map<string, Candidate>,
): string[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const byKey = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = nameKey(c.name);
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), c]);
  }
  const taken = new Set<number>(Object.values(forced));
  const pending = characters.filter((c) => !matches.has(c.id));

  for (const character of pending) {
    const forcedId = forced[character.id];
    if (forcedId !== undefined) {
      matches.set(character.id, byId.get(forcedId)!);
      continue;
    }
    for (const form of [character.name.en, character.name.fr, ...character.aliases]) {
      // Un nom porté par plusieurs fiches est ambigu : on ne tranche pas au hasard
      const found = byKey.get(nameKey(form));
      if (found?.length === 1 && !taken.has(found[0].id)) {
        matches.set(character.id, found[0]);
        taken.add(found[0].id);
        break;
      }
    }
  }

  const variants: string[] = [];
  for (const character of pending.filter((c) => !matches.has(c.id))) {
    const key = looseKey(character.name.en);
    const same = candidates.filter((c) => !taken.has(c.id) && looseKey(c.name) === key);
    if (!key || same.length !== 1) continue;
    matches.set(character.id, same[0]);
    taken.add(same[0].id);
    variants.push(`${character.name.en} ← ${same[0].name}`);
  }
  return variants;
}

async function main() {
  const dry = process.argv.includes("--dry");
  const refresh = process.argv.includes("--refresh");

  const characters = (await readJson<Character[]>(path.join(GENERATED_DIR, "characters.json")))
    .filter((c) => c.canon)
    .sort((a, b) => a.tier - b.tier);

  const sources: { label: string; file: string; candidates: Candidate[] }[] = [];
  const anilist = await cached("anilist/characters.json", refresh, fetchAniListCharacters);
  if (anilist) sources.push({ label: "AniList", file: "anilist-ids.json", candidates: aniListCandidates(anilist) });
  const jikan = await cached("jikan/characters.json", refresh, fetchJikanCharacters);
  if (jikan) sources.push({ label: "MyAnimeList", file: "mal-ids.json", candidates: jikanCandidates(jikan) });
  if (sources.length === 0) throw new Error("Aucune source d'images disponible");

  const matches = new Map<string, Candidate>();
  for (const { label, file, candidates } of sources) {
    const forced = await readForced(file);
    const byId = new Set(candidates.map((c) => c.id));
    for (const [id, forcedId] of Object.entries(forced)) {
      if (!characters.some((c) => c.id === id)) throw new Error(`${file} : personnage inconnu : ${id}`);
      if (!byId.has(forcedId)) throw new Error(`${file} : fiche ${label} sans image : ${forcedId}`);
    }
    const before = matches.size;
    const variants = match(characters, candidates, forced, matches);
    console.log(`${label} : ${candidates.length} fiches avec image, ${matches.size - before} personnages rapprochés`);
    if (variants.length > 0) console.log(`  dont par variante de transcription (${variants.length}) : ${variants.join(" | ")}`);
    if (dry) {
      const used = new Set([...matches.values()].map((c) => c.id));
      const free = candidates.filter((c) => !used.has(c.id)).map((c) => `${c.id}:${c.name}`);
      console.log(`  fiches non utilisées (${free.length}) : ${free.join(" | ")}`);
    }
  }

  const unmatched = characters.filter((c) => !matches.has(c.id));
  console.log(`Rapprochés : ${matches.size} sur ${characters.length} personnages du manga`);
  for (const tier of [1, 2, 3]) {
    const names = unmatched.filter((c) => c.tier === tier).map((c) => c.name.en);
    console.log(`Sans image, notoriété ${tier} (${names.length}) : ${names.join(", ")}`);
  }
  if (dry) return;

  const previous = await readJsonOr<ImageManifest>(path.join(GENERATED_DIR, "images.json"), { portraits: {} });
  const manifest: ImageManifest = { portraits: {} };
  let downloaded = 0;
  for (const [id, candidate] of matches) {
    const source = `${candidate.source}:${candidate.id}`;
    const file = hashedName("portrait", id);
    const target = path.join(ROOT, "public/images/portraits", `${file}.webp`);
    // Un portrait qui change de source est repris : l'image en place vient de l'autre
    if (existsSync(target) && previous.portraits[id]?.source !== source) await rm(target);
    if (!existsSync(target)) {
      const res = await fetch(candidate.url, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status} pour ${candidate.url}`);
      await mkdir(path.dirname(target), { recursive: true });
      await sharp(Buffer.from(await res.arrayBuffer()))
        .resize({ width: PORTRAIT_WIDTH, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(target);
      downloaded++;
      await sleep(candidate.source === "mal" ? 400 : 100);
    }
    const { width, height } = await sharp(target).metadata();
    manifest.portraits[id] = { file, width: width!, height: height!, source };
  }
  await writeJson(path.join(GENERATED_DIR, "images.json"), imageManifestSchema.parse(manifest));
  console.log(`${downloaded} image(s) téléchargée(s), ${matches.size} dans l'inventaire`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
