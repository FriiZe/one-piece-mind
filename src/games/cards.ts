/**
 * Données des jeux, sous une forme compacte envoyée au navigateur. Construites
 * côté serveur à partir du jeu de données ; `resolveGameData` les ramène
 * ensuite au mode spoiler du joueur.
 */
import emojisJson from "@data/curated/emojis.json";
import epithetsJson from "@data/curated/epithets.json";
import laughsJson from "@data/curated/laughs.json";
import shipsJson from "@data/curated/ships.json";
import techniquesJson from "@data/curated/techniques.json";
import weaponsJson from "@data/curated/weapons.json";
import { arcOfChapter, arcs, characters, fruits, groups, images, meta } from "@/lib/data";
import { mainAffiliation, translateAffiliation, type HakiType } from "@/lib/data/labels";
import type { Character, FruitType, Race, Sea } from "@/lib/data/schema";
import { currentBounty, isPlayableCharacter, isPlayableFruit, viewCharacter, type SpoilerMode } from "@/lib/spoilers";

/** Faits d'un personnage qui peuvent différer entre le mode anime et le mode manga. */
type ModeFacts = {
  bounty: number | null;
  affiliation: string | null;
  sea: Sea | null;
  fruitId: string | null;
};

export type CharacterCard = ModeFacts & {
  id: string;
  name: string;
  /** Nom d'usage international, affiché en complément quand il diffère du nom français. */
  altName: string | null;
  aliases: string[];
  tier: number;
  /** Chapitre de première apparition. */
  debut: number;
  /** Épisode de première apparition, `null` s'il n'est pas connu. */
  episode: number | null;
  /** Numéro de l'arc de première apparition (voir `GameData.arcs`), `null` pour le chapitre 0. */
  arc: number | null;
  gender: "male" | "female" | null;
  races: Race[];
  age: number | null;
  height: number | null;
  haki: HakiType[];
  /**
   * Fichier du portrait dans /images/portraits/, sans extension ; `null` sans
   * portrait. Le nom ne dit rien du personnage : il ne donne pas la réponse.
   */
  img: string | null;
  /** Valeurs à utiliser en mode anime, quand elles diffèrent. */
  anime?: Partial<ModeFacts>;
};

export type FruitCard = {
  id: string;
  name: string;
  romaji: string | null;
  type: FruitType;
  debut: number;
};

export type GroupCard = { id: string; title: string; since: number; memberIds: string[] };

/** Contenus rédigés à la main (data/curated) : surnoms, techniques, armes, navires, devinettes. */
export type Extras = {
  epithets: { characterId: string; text: string }[];
  techniques: { name: string; characterId: string }[];
  weapons: { name: string; kind: string; characterId: string }[];
  /** `crew` : nom français de l'équipage. */
  ships: { name: string; crew: string }[];
  emojis: { characterId: string; emojis: string }[];
  /** Rire caractéristique, écrit. */
  laughs: { characterId: string; text: string }[];
};

export type GameData = {
  animeCutoffChapter: number;
  latestChapter: number;
  latestEpisode: number;
  extras: Extras;
  arcs: { number: number; title: string }[];
  characters: CharacterCard[];
  fruits: FruitCard[];
  groups: GroupCard[];
};

const fruitsById = new Map(fruits.map((f) => [f.id, f]));

function modeFacts(character: Character, mode: SpoilerMode): ModeFacts {
  const view = viewCharacter(character, mode);
  const fruit = view.fruitId ? fruitsById.get(view.fruitId) : undefined;
  return {
    bounty: currentBounty(view),
    affiliation: mainAffiliation(view),
    sea: view.origin?.sea ?? null,
    fruitId: fruit && isPlayableFruit(fruit, mode) ? fruit.id : null,
  };
}

function toCard(character: Character): CharacterCard {
  const manga = modeFacts(character, "manga");
  const anime = modeFacts(character, "anime");
  const diff: Partial<ModeFacts> = {};
  for (const key of Object.keys(manga) as (keyof ModeFacts)[]) {
    if (manga[key] !== anime[key]) Object.assign(diff, { [key]: anime[key] });
  }

  const debut = character.debut!.chapter!;
  const { name, aliases, haki } = character;
  return {
    id: character.id,
    name: name.fr,
    altName: name.en.toLowerCase() === name.fr.toLowerCase() ? null : name.en,
    aliases,
    tier: character.tier,
    debut,
    episode: character.debut!.episode,
    arc: arcOfChapter(debut)?.number ?? null,
    gender: character.gender,
    races: character.races,
    age: character.age,
    height: character.height,
    haki: (Object.keys(haki) as HakiType[]).filter((type) => haki[type]),
    img: images.portraits[character.id]?.file ?? null,
    ...manga,
    ...(Object.keys(diff).length ? { anime: diff } : {}),
  };
}

export function buildGameData(): GameData {
  return {
    animeCutoffChapter: meta.animeCutoffChapter,
    latestChapter: meta.latestChapter,
    latestEpisode: meta.latestEpisode,
    extras: {
      epithets: Object.entries(epithetsJson.epithets).map(([characterId, text]) => ({ characterId, text })),
      techniques: techniquesJson.techniques,
      weapons: weaponsJson.weapons,
      ships: shipsJson.ships.map((ship) => ({ name: ship.name, crew: translateAffiliation(ship.crew) })),
      emojis: Object.entries(emojisJson.emojis).map(([characterId, emojis]) => ({ characterId, emojis })),
      laughs: Object.entries(laughsJson.laughs).map(([characterId, text]) => ({ characterId, text })),
    },
    arcs: arcs
      .filter((arc) => arc.kind === "manga")
      .map((arc) => ({ number: arc.number, title: arc.title.fr.replace(/^Arc\s+/i, "").trim() })),
    characters: characters.filter((c) => isPlayableCharacter(c, "manga")).map(toCard),
    fruits: fruits
      .filter((f) => isPlayableFruit(f, "manga"))
      .map((f) => ({ id: f.id, name: f.name.fr, romaji: f.romaji, type: f.type, debut: f.debut!.chapter! })),
    groups: groups.map((g) => ({ id: g.id, title: g.title, since: g.since, memberIds: g.memberIds })),
  };
}

// ---------------------------------------------------------------------------
// Côté navigateur

export type PlayCharacter = Omit<CharacterCard, "anime">;

/** Les données telles que le joueur a le droit de les voir dans son mode. */
export type ResolvedData = {
  mode: SpoilerMode;
  /** Dernier chapitre (mode manga) ou dernier chapitre adapté (mode anime) que le joueur connaît. */
  latestChapter: number;
  latestEpisode: number;
  extras: Extras;
  arcs: Map<number, string>;
  characters: PlayCharacter[];
  characterById: Map<string, PlayCharacter>;
  fruits: FruitCard[];
  fruitById: Map<string, FruitCard>;
  groups: GroupCard[];
};

export function resolveGameData(data: GameData, mode: SpoilerMode): ResolvedData {
  const limit = mode === "anime" ? data.animeCutoffChapter : Infinity;

  const resolved = data.characters
    .filter((c) => c.debut <= limit)
    .map(({ anime, ...card }): PlayCharacter => (mode === "anime" ? { ...card, ...anime } : card));
  const characterById = new Map(resolved.map((c) => [c.id, c]));
  const playableFruits = data.fruits.filter((f) => f.debut <= limit);

  // Un contenu rédigé n'est montré que si son personnage est déjà connu du joueur
  const known = <T extends { characterId: string }>(items: T[]) => items.filter((item) => characterById.has(item.characterId));

  return {
    mode,
    latestChapter: mode === "anime" ? data.animeCutoffChapter : data.latestChapter,
    latestEpisode: data.latestEpisode,
    extras: {
      epithets: known(data.extras.epithets),
      techniques: known(data.extras.techniques),
      weapons: known(data.extras.weapons),
      ships: data.extras.ships,
      emojis: known(data.extras.emojis),
      laughs: known(data.extras.laughs),
    },
    arcs: new Map(data.arcs.map((arc) => [arc.number, arc.title])),
    characters: resolved,
    characterById,
    fruits: playableFruits,
    fruitById: new Map(playableFruits.map((f) => [f.id, f])),
    // Un groupe n'est proposé que si sa composition est connue et tous ses membres déjà apparus
    groups: data.groups.filter((g) => g.since <= limit && g.memberIds.every((id) => characterById.has(id))),
  };
}

export function portraitUrl(file: string): string {
  return `/images/portraits/${file}.webp`;
}
