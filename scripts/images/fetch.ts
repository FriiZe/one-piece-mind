/**
 * Récupère les portraits officiels de l'anime auprès de l'API publique
 * d'AniList et les rattache aux personnages du jeu de données.
 *
 * (Le One Piece Wiki, source du reste des données, protège ses images contre
 * les téléchargements automatisés : on ne passe pas outre.)
 *
 * Les images sont converties en WebP et rangées sous un nom qui ne révèle pas
 * le personnage : un jeu ne doit pas donner sa réponse dans l'adresse de
 * l'image. L'inventaire est écrit dans data/generated/images.json.
 *
 * Usage : npm run images:fetch            télécharge ce qui manque
 *         npm run images:fetch -- --dry   rapproche les noms sans rien télécharger
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
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
/** One Piece (série animée) sur AniList. */
const MEDIA_ID = 21;
const PORTRAIT_WIDTH = 360;

type AniListCharacter = {
  id: number;
  name: { full: string | null; first: string | null; last: string | null };
  image: { large: string | null };
};

export function hashedName(kind: string, key: string): string {
  return createHash("sha1").update(`opm:${kind}:${key}`).digest("hex").slice(0, 12);
}

const QUERY = `query ($page: Int) {
  Media(id: ${MEDIA_ID}, type: ANIME) {
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
      body: JSON.stringify({ query: QUERY, variables: { page } }),
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

/** Clé de rapprochement : les mots du nom, sans ordre (AniList écrit « Luffy Monkey »), sans initiale isolée. */
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

/** AniList masque les images absentes derrière une image par défaut. */
const isPlaceholder = (url: string) => /\/default\./.test(url);

async function main() {
  const dry = process.argv.includes("--dry");
  const cache = path.join(RAW_DIR, "anilist/characters.json");
  let source = await readJsonOr<AniListCharacter[] | null>(cache, null);
  if (!source) {
    source = await fetchAniListCharacters();
    await writeJson(cache, source);
  }
  const usable = source.filter((c) => c.image.large && !isPlaceholder(c.image.large));

  const { _comment, ...forced } = await readJson<Record<string, number | string>>(
    path.join(OVERRIDES_DIR, "anilist-ids.json"),
  );
  void _comment;

  const byKey = new Map<string, AniListCharacter[]>();
  for (const c of usable) {
    const key = nameKey(c.name.full ?? "");
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), c]);
  }
  const byId = new Map(usable.map((c) => [c.id, c]));

  const characters = (await readJson<Character[]>(path.join(GENERATED_DIR, "characters.json")))
    .filter((c) => c.canon)
    .sort((a, b) => a.tier - b.tier);

  for (const [id, anilistId] of Object.entries(forced)) {
    if (!characters.some((c) => c.id === id)) throw new Error(`anilist-ids.json : personnage inconnu : ${id}`);
    if (!byId.has(anilistId as number)) throw new Error(`anilist-ids.json : fiche AniList sans image : ${anilistId}`);
  }

  const matches = new Map<string, AniListCharacter>();
  const taken = new Set<number>(Object.values(forced) as number[]);
  for (const character of characters) {
    const forcedId = forced[character.id] as number | undefined;
    if (forcedId !== undefined) {
      matches.set(character.id, byId.get(forcedId)!);
      continue;
    }
    let match: AniListCharacter | undefined;
    {
      for (const form of [character.name.en, character.name.fr, ...character.aliases]) {
        // Un nom porté par plusieurs fiches AniList est ambigu : on ne tranche pas au hasard
        const candidates = byKey.get(nameKey(form));
        if (candidates?.length === 1) {
          match = candidates[0];
          break;
        }
      }
    }
    if (match && !taken.has(match.id)) {
      matches.set(character.id, match);
      taken.add(match.id);
    }
  }

  // Second passage : mêmes noms à la transcription des voyelles longues près
  // (« Ryuma » / « Ryuuma », « Rakuyo » / « Rakuyou »).
  const loose = (name: string) => nameKey(name).replace(/ou|oo/g, "o").replace(/uu/g, "u");
  const variants: string[] = [];
  for (const character of characters.filter((c) => !matches.has(c.id))) {
    const key = loose(character.name.en);
    const same = usable.filter((c) => !taken.has(c.id) && loose(c.name.full ?? "") === key);
    if (!key || same.length !== 1) continue;
    matches.set(character.id, same[0]);
    taken.add(same[0].id);
    variants.push(`${character.name.en} ← ${same[0].name.full}`);
  }

  const unmatched = characters.filter((c) => !matches.has(c.id));
  console.log(`AniList : ${source.length} personnages, dont ${usable.length} avec une image`);
  console.log(`Rapprochés : ${matches.size} sur ${characters.length} personnages du manga`);
  for (const tier of [1, 2]) {
    const names = unmatched.filter((c) => c.tier === tier).map((c) => c.name.en);
    console.log(`Sans image, notoriété ${tier} (${names.length}) : ${names.join(", ")}`);
  }
  console.log(`Dont par variante de transcription (${variants.length}) : ${variants.join(" | ")}`);
  if (dry) {
    const free = usable.filter((c) => !taken.has(c.id)).map((c) => `${c.id}:${c.name.full}`);
    console.log(`Fiches AniList non utilisées (${free.length}) : ${free.join(" | ")}`);
    return;
  }

  const manifest: ImageManifest = { portraits: {} };
  let downloaded = 0;
  for (const [id, match] of matches) {
    const file = hashedName("portrait", id);
    const target = path.join(ROOT, "public/images/portraits", `${file}.webp`);
    if (!existsSync(target)) {
      const res = await fetch(match.image.large!, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status} pour ${match.image.large}`);
      await mkdir(path.dirname(target), { recursive: true });
      await sharp(Buffer.from(await res.arrayBuffer()))
        .resize({ width: PORTRAIT_WIDTH, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(target);
      downloaded++;
      await sleep(100);
    }
    const { width, height } = await sharp(target).metadata();
    manifest.portraits[id] = { file, width: width!, height: height!, source: `anilist:${match.id}` };
  }
  await writeJson(path.join(GENERATED_DIR, "images.json"), imageManifestSchema.parse(manifest));
  console.log(`${downloaded} image(s) téléchargée(s), ${matches.size} dans l'inventaire`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
