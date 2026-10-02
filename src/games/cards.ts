/**
 * Données des jeux, sous une forme compacte envoyée au navigateur. Construites
 * côté serveur à partir du jeu de données, une fois par langue : noms et
 * libellés y sont déjà dans la langue du joueur. `resolveGameData` les ramène
 * ensuite à son mode spoiler.
 */
import emojisJson from "@data/curated/emojis.json";
import epithetsJson from "@data/curated/epithets.json";
import shipsJson from "@data/curated/ships.json";
import techniquesJson from "@data/curated/techniques.json";
import weaponsJson from "@data/curated/weapons.json";
import { arcOfChapter, arcs, characters, fruits, groups, images, meta } from "@/lib/data";
import { MAIN_AFFILIATION_OVERRIDES, mainOrganization, organizationOf, translateAffiliation, type HakiType } from "@/lib/data/labels";
import type { Character, FruitType, Race, Sea } from "@/lib/data/schema";
import { DEFAULT_LOCALE, type Locale, type Localized } from "@/lib/i18n";
import { currentBounty, isPlayableCharacter, isPlayableFruit, viewCharacter, type SpoilerMode } from "@/lib/spoilers";

/** Faits d'un personnage qui peuvent différer entre le mode anime et le mode manga. */
type ModeFacts = {
  bounty: number | null;
  /** Organisation principale, sous son nom du wiki : le même dans toutes les langues, il sert de clé. */
  org: string | null;
  /** La même, telle qu'elle s'affiche dans la langue du joueur. */
  affiliation: string | null;
  /** Ses autres organisations actuelles, sous leur nom du wiki : y répondre n'est pas une erreur. */
  also: string[];
  /** Celles qu'il a quittées, sous leur nom du wiki : elles ne servent pas de leurres. */
  past: string[];
  sea: Sea | null;
  fruitId: string | null;
};

export type CharacterCard = ModeFacts & {
  id: string;
  name: string;
  /** En français, nom d'usage international, affiché en complément quand il diffère du nom français. */
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
  /** N'a jamais appartenu qu'à une seule organisation : il n'est membre, même ancien, d'aucune autre. */
  solo: boolean;
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
  /** `crew` : nom de l'équipage dans la langue du joueur. */
  ships: { name: string; crew: string }[];
  emojis: { characterId: string; emojis: string }[];
};

export type GameData = {
  locale: Locale;
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

/** Un texte rédigé à la main : écrit une seule fois s'il est le même dans les deux langues. */
const text = (value: string | Localized, locale: Locale) => (typeof value === "string" ? value : value[locale]);

function modeFacts(character: Character, mode: SpoilerMode, locale: Locale): ModeFacts {
  const view = viewCharacter(character, mode);
  const fruit = view.fruitId ? fruitsById.get(view.fruitId) : undefined;
  const org = mainOrganization(view);
  const others = view.affiliations.map((a) => ({ key: organizationOf(a.name), former: a.former })).filter((a) => a.key !== org);
  const also = [...new Set(others.filter((a) => !a.former).map((a) => a.key))];
  return {
    bounty: currentBounty(view),
    org,
    affiliation: org && translateAffiliation(org, locale),
    also,
    past: [...new Set(others.filter((a) => a.former && !also.includes(a.key)).map((a) => a.key))],
    sea: view.origin?.sea ?? null,
    fruitId: fruit && isPlayableFruit(fruit, mode) ? fruit.id : null,
  };
}

/** Toutes les organisations d'un personnage, passées comprises. */
function organizations(character: Character): Set<string> {
  const forced = MAIN_AFFILIATION_OVERRIDES[character.id];
  return new Set([...character.affiliations.map((a) => organizationOf(a.name)), ...(forced ? [forced] : [])]);
}

function toCard(character: Character, locale: Locale): CharacterCard {
  const manga = modeFacts(character, "manga", locale);
  const anime = modeFacts(character, "anime", locale);
  const diff: Partial<ModeFacts> = {};
  for (const key of Object.keys(manga) as (keyof ModeFacts)[]) {
    // Les listes se comparent par leur contenu
    if (JSON.stringify(manga[key]) !== JSON.stringify(anime[key])) Object.assign(diff, { [key]: anime[key] });
  }

  const debut = character.debut!.chapter!;
  const { name, aliases, haki } = character;
  const sameName = name.en.toLowerCase() === name.fr.toLowerCase();
  return {
    id: character.id,
    name: name[locale],
    altName: locale === "fr" && !sameName ? name.en : null,
    // En anglais, le nom français n'est pas affiché mais reste accepté à la saisie
    aliases: locale === "fr" || sameName ? aliases : [...aliases, name.fr],
    tier: character.tier,
    debut,
    episode: character.debut!.episode,
    arc: arcOfChapter(debut)?.number ?? null,
    gender: character.gender,
    races: character.races,
    age: character.age,
    height: character.height,
    haki: (Object.keys(haki) as HakiType[]).filter((type) => haki[type]),
    solo: organizations(character).size === 1,
    img: images.portraits[character.id]?.file ?? null,
    ...manga,
    ...(Object.keys(diff).length ? { anime: diff } : {}),
  };
}

export function buildGameData(locale: Locale = DEFAULT_LOCALE): GameData {
  return {
    locale,
    animeCutoffChapter: meta.animeCutoffChapter,
    latestChapter: meta.latestChapter,
    latestEpisode: meta.latestEpisode,
    extras: {
      epithets: Object.entries(epithetsJson.epithets).map(([characterId, epithet]) => ({ characterId, text: epithet[locale] })),
      techniques: techniquesJson.techniques,
      weapons: weaponsJson.weapons.map((weapon) => ({ ...weapon, name: text(weapon.name, locale), kind: text(weapon.kind, locale) })),
      ships: shipsJson.ships.map((ship) => ({ name: text(ship.name, locale), crew: translateAffiliation(ship.crew, locale) })),
      emojis: Object.entries(emojisJson.emojis).map(([characterId, emojis]) => ({ characterId, emojis })),
    },
    arcs: arcs
      .filter((arc) => arc.kind === "manga")
      // « Arc Skypiea » en français, « Skypiea Arc » en anglais : on ne garde que le nom
      .map((arc) => ({ number: arc.number, title: arc.title[locale].replace(/^Arc\s+|\s+Arc$/gi, "").trim() })),
    characters: characters.filter((c) => isPlayableCharacter(c, "manga")).map((c) => toCard(c, locale)),
    fruits: fruits
      .filter((f) => isPlayableFruit(f, "manga"))
      .map((f) => ({
        id: f.id,
        name: f.name[locale],
        // Le nom anglais d'un fruit est déjà son nom japonais
        romaji: f.romaji?.toLowerCase() === f.name[locale].toLowerCase() ? null : f.romaji,
        type: f.type,
        debut: f.debut!.chapter!,
      })),
    groups: groups.map((g) => ({ id: g.id, title: g.title[locale], since: g.since, memberIds: g.memberIds })),
  };
}

// ---------------------------------------------------------------------------
// Côté navigateur

export type PlayCharacter = Omit<CharacterCard, "anime">;

/** Les données telles que le joueur a le droit de les voir dans son mode. */
export type ResolvedData = {
  /** Langue des noms et des libellés : les textes que produisent les jeux la suivent. */
  locale: Locale;
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
    locale: data.locale,
    mode,
    latestChapter: mode === "anime" ? data.animeCutoffChapter : data.latestChapter,
    latestEpisode: data.latestEpisode,
    extras: {
      epithets: known(data.extras.epithets),
      techniques: known(data.extras.techniques),
      weapons: known(data.extras.weapons),
      ships: data.extras.ships,
      emojis: known(data.extras.emojis),
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
