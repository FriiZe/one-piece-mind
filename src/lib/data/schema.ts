import { z } from "zod";

/**
 * Schéma du jeu de données (data/generated/*.json).
 *
 * Règle spoilers : tout fait susceptible d'être révélé tard porte `since`, le
 * chapitre où il est établi (`null` = inconnu, considéré comme connu de tous).
 * Voir src/lib/spoilers.ts pour le filtrage selon le mode anime / manga.
 */

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
/** Le chapitre 0 existe : prologue du film Strong World, situé avant le chapitre 1. */
const chapter = z.number().int().nonnegative();
const since = chapter.nullable();

export const localizedSchema = z.object({ fr: z.string().min(1), en: z.string().min(1) });

export const debutSchema = z.object({
  chapter: chapter.nullable(),
  /** L'épisode 0 existe aussi (adaptation du chapitre 0). */
  episode: z.number().int().nonnegative().nullable(),
});

export const SEAS = [
  "east-blue",
  "west-blue",
  "north-blue",
  "south-blue",
  "grand-line",
  "calm-belt",
  "red-line",
  "sky",
] as const;
export const seaSchema = z.enum(SEAS);

export const RACES = [
  "human",
  "giant",
  "fishman",
  "merfolk",
  "mink",
  "dwarf",
  "cyborg",
  "lunarian",
  "buccaneer",
  "skypiean",
  "longarm",
  "longleg",
  "snakeneck",
  "homie",
  "clone",
  "animal",
] as const;
export const raceSchema = z.enum(RACES);

export const FRUIT_TYPES = [
  "paramecia",
  "logia",
  "zoan",
  "zoan-ancient",
  "zoan-mythical",
  "smile",
  "artificial",
] as const;
export const fruitTypeSchema = z.enum(FRUIT_TYPES);

export const characterSchema = z.object({
  id: slug,
  apiId: z.number().int(),
  wikiTitle: z.string().nullable(),
  name: localizedSchema,
  /** Autres graphies acceptées comme réponse (noms VO, surnoms d'usage). */
  aliases: z.array(z.string().min(1)),
  /** Personnage du manga (faux : film, hors-série, épisodes hors manga, ou non vérifié). */
  canon: z.boolean(),
  /** Notoriété, de 1 (personnage majeur) à 4 (figurant) : sert à doser la difficulté. */
  tier: z.number().int().min(1).max(4),
  /** Première apparition ; `null` si la fiche n'a pas pu être vérifiée. */
  debut: debutSchema.nullable(),
  gender: z.enum(["male", "female"]).nullable(),
  races: z.array(raceSchema),
  origin: z.object({ sea: seaSchema, place: z.string().nullable(), since }).nullable(),
  age: z.number().int().positive().nullable(),
  /** Taille en centimètres. */
  height: z.number().positive().nullable(),
  status: z.enum(["alive", "deceased", "unknown"]),
  /** Primes de la plus récente à la plus ancienne. */
  bounties: z.array(z.object({ amount: z.number().int().nonnegative(), since })),
  epithets: z.array(z.object({ en: z.string().min(1), since })),
  affiliations: z.array(z.object({ name: z.string().min(1), former: z.boolean(), since })),
  occupations: z.array(z.object({ name: z.string().min(1), former: z.boolean(), since })),
  crewId: slug.nullable(),
  job: z.string().nullable(),
  fruitId: slug.nullable(),
  haki: z.object({ observation: z.boolean(), armament: z.boolean(), conqueror: z.boolean() }),
});

export const fruitSchema = z.object({
  id: slug,
  apiId: z.number().int(),
  wikiTitle: z.string().nullable(),
  name: localizedSchema,
  romaji: z.string().nullable(),
  type: fruitTypeSchema,
  description: z.string().nullable(),
  debut: debutSchema.nullable(),
  userIds: z.array(slug),
});

export const crewSchema = z.object({
  id: slug,
  apiId: z.number().int(),
  name: localizedSchema,
  romaji: z.string().nullable(),
  isYonko: z.boolean(),
  totalBounty: z.number().int().nonnegative().nullable(),
  status: z.string().nullable(),
});

export const sagaSchema = z.object({
  id: slug,
  number: z.number().int().positive(),
  title: localizedSchema,
});

export const arcSchema = z.object({
  id: slug,
  number: z.number().int().positive(),
  title: localizedSchema,
  sagaId: slug,
  /** manga : adapte des chapitres ; cover : mini-aventure des pages de titre ; filler : propre à l'anime. */
  kind: z.enum(["manga", "cover", "filler"]),
  /** Chapitres couverts, bornes incluses ; `null` hors arcs du manga. */
  chapters: z.object({ first: chapter, last: chapter }).nullable(),
  episodes: z.object({ first: z.number().int().positive(), last: z.number().int().positive() }).nullable(),
});

export const islandSchema = z.object({
  id: slug,
  apiId: z.number().int(),
  name: localizedSchema,
  romaji: z.string().nullable(),
  sea: z.string().nullable(),
  region: z.string().nullable(),
});

export const shipSchema = z.object({
  id: slug,
  apiId: z.number().int(),
  name: localizedSchema,
  romaji: z.string().nullable(),
  type: z.string().nullable(),
  crewId: slug.nullable(),
});

export const swordSchema = z.object({
  id: slug,
  name: localizedSchema,
  romaji: z.string().nullable(),
  category: z.string().nullable(),
  type: z.string().nullable(),
  destroyed: z.boolean(),
});

export const groupSchema = z.object({
  id: slug,
  title: z.string().min(1),
  /** Chapitre à partir duquel la composition complète du groupe est connue. */
  since: chapter,
  memberIds: z.array(slug).min(2),
});

/** Inventaire des images (data/generated/images.json, produit par scripts/images/fetch.ts). */
export const imageManifestSchema = z.object({
  portraits: z.record(
    slug,
    z.object({
      /** Nom du fichier, sans extension, dans public/images/portraits/. */
      file: z.string().regex(/^[a-f0-9]{12}$/),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      source: z.string().min(1),
    }),
  ),
});

export const metaSchema = z.object({
  /** Dernier chapitre connu du jeu de données. */
  latestChapter: chapter,
  latestEpisode: z.number().int().positive(),
  /** Dernier chapitre adapté par l'anime : limite du mode « à jour sur l'anime ». */
  animeCutoffChapter: chapter,
  counts: z.record(z.string(), z.number().int().nonnegative()),
  sources: z.array(z.object({ name: z.string(), url: z.string().url(), license: z.string() })),
});

export type Localized = z.infer<typeof localizedSchema>;
export type Sea = z.infer<typeof seaSchema>;
export type Race = z.infer<typeof raceSchema>;
export type FruitType = z.infer<typeof fruitTypeSchema>;
export type Character = z.infer<typeof characterSchema>;
export type Fruit = z.infer<typeof fruitSchema>;
export type Crew = z.infer<typeof crewSchema>;
export type Saga = z.infer<typeof sagaSchema>;
export type Arc = z.infer<typeof arcSchema>;
export type Island = z.infer<typeof islandSchema>;
export type Ship = z.infer<typeof shipSchema>;
export type Sword = z.infer<typeof swordSchema>;
export type Group = z.infer<typeof groupSchema>;
export type ImageManifest = z.infer<typeof imageManifestSchema>;
export type DatasetMeta = z.infer<typeof metaSchema>;

export const DATASET_FILES = {
  characters: z.array(characterSchema),
  fruits: z.array(fruitSchema),
  crews: z.array(crewSchema),
  sagas: z.array(sagaSchema),
  arcs: z.array(arcSchema),
  islands: z.array(islandSchema),
  ships: z.array(shipSchema),
  swords: z.array(swordSchema),
  groups: z.array(groupSchema),
  meta: metaSchema,
} as const;
