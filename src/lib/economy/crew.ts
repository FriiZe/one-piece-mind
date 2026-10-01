import { GAME_CATEGORIES, type GameCategoryId } from "@/lib/games/catalog";
import type { Localized } from "@/lib/i18n";
import { POST_IDS, type CollectionEntry, type PlayerState, type PostId, type Recruitable } from "./types";

type BonusKind =
  | { kind: "berrys"; scope: "all" | "daily" | GameCategoryId }
  | { kind: "recruit" }
  | { kind: "golden" }
  | { kind: "discount" };

export const POSTS: Record<PostId, { label: Localized; effect: Localized; bonus: BonusKind }> = {
  capitaine: {
    label: { fr: "Capitaine", en: "Captain" },
    effect: { fr: "Berrys sur tous les jeux", en: "Berries on every game" },
    bonus: { kind: "berrys", scope: "all" },
  },
  sabreur: {
    label: { fr: "Sabreur", en: "Swordsman" },
    effect: { fr: "Berrys sur les défis", en: "Berries on challenges" },
    bonus: { kind: "berrys", scope: "defis" },
  },
  navigateur: {
    label: { fr: "Navigateur", en: "Navigator" },
    effect: { fr: "Chances de recruter après une partie", en: "Chance to recruit after a game" },
    bonus: { kind: "recruit" },
  },
  tireur: {
    label: { fr: "Tireur d'élite", en: "Sniper" },
    effect: { fr: "Berrys sur les jeux « À l'œil »", en: "Berries on “By Eye” games" },
    bonus: { kind: "berrys", scope: "oeil" },
  },
  cuisinier: {
    label: { fr: "Cuisinier", en: "Cook" },
    effect: { fr: "Berrys sur le défi du jour", en: "Berries on the daily challenge" },
    bonus: { kind: "berrys", scope: "daily" },
  },
  medecin: {
    label: { fr: "Médecin", en: "Doctor" },
    effect: { fr: "Berrys sur les jeux « Savoir »", en: "Berries on “Knowledge” games" },
    bonus: { kind: "berrys", scope: "savoir" },
  },
  archeologue: {
    label: { fr: "Archéologue", en: "Archaeologist" },
    effect: { fr: "Berrys sur les jeux « Mots et indices »", en: "Berries on “Words and Clues” games" },
    bonus: { kind: "berrys", scope: "mots" },
  },
  charpentier: {
    label: { fr: "Charpentier", en: "Shipwright" },
    effect: { fr: "Berrys sur les jeux « Primes et mesures »", en: "Berries on “Bounties and Stats” games" },
    bonus: { kind: "berrys", scope: "primes" },
  },
  musicien: {
    label: { fr: "Musicien", en: "Musician" },
    effect: { fr: "Réduction à la boutique", en: "Discount at the shop" },
    bonus: { kind: "discount" },
  },
  timonier: {
    label: { fr: "Timonier", en: "Helmsman" },
    effect: { fr: "Chances d'obtenir un avis doré", en: "Chance to get a golden poster" },
    bonus: { kind: "golden" },
  },
};

/** Force d'un bonus selon la rareté du personnage placé au poste (1 = légendaire). */
const STRENGTH_BY_TIER: Record<number, number> = { 1: 0.2, 2: 0.14, 3: 0.09, 4: 0.05 };
/** Un avis doré renforce le bonus du poste. */
const GOLDEN_FACTOR = 1.5;
/** Le capitaine agit partout : son bonus est divisé par deux. */
const CAPTAIN_FACTOR = 0.5;
/**
 * Traits d'équipage : plusieurs membres d'une même affiliation, placés à des
 * postes, activent le trait de cette affiliation. Il a trois paliers, selon
 * le nombre de membres : plus ils sont nombreux, plus le bonus est fort.
 */
export const TRAIT_STEPS = [3, 5, 7] as const;

type TraitDefinition = { name: Localized; bonus: BonusKind; values: readonly [number, number, number] };
const allGames = { kind: "berrys", scope: "all" } as const;
const category = (scope: GameCategoryId) => ({ kind: "berrys", scope }) as const;

/**
 * Trait de chaque grande affiliation. La clé est le nom de l'organisation sur
 * le wiki (`org` d'un personnage) : il ne dépend pas de la langue du joueur.
 */
export const TRAITS: Record<string, TraitDefinition> = {
  "Straw Hat Pirates": { name: { fr: "Nakama", en: "Nakama" }, bonus: allGames, values: [0.08, 0.14, 0.22] },
  "Whitebeard Pirates": { name: { fr: "Fils de Barbe Blanche", en: "Sons of Whitebeard" }, bonus: allGames, values: [0.05, 0.09, 0.14] },
  "Revolutionary Army": { name: { fr: "Vent de révolte", en: "Winds of Revolt" }, bonus: { kind: "discount" }, values: [0.1, 0.18, 0.25] },
  "Blackbeard Pirates": { name: { fr: "Pillage", en: "Plunder" }, bonus: { kind: "discount" }, values: [0.08, 0.15, 0.22] },
  Marines: { name: { fr: "Justice", en: "Justice" }, bonus: category("savoir"), values: [0.1, 0.18, 0.28] },
  "Beasts Pirates": { name: { fr: "Loi du plus fort", en: "Survival of the Fittest" }, bonus: category("defis"), values: [0.1, 0.18, 0.28] },
  "Cipher Pol": { name: { fr: "Agents de l'ombre", en: "Shadow Agents" }, bonus: category("oeil"), values: [0.1, 0.18, 0.28] },
  "Donquixote Pirates": { name: { fr: "Marionnettes", en: "Puppets" }, bonus: category("mots"), values: [0.1, 0.18, 0.28] },
  "Kouzuki Family": { name: { fr: "Fourreaux rouges", en: "Red Scabbards" }, bonus: category("primes"), values: [0.1, 0.18, 0.28] },
  "Red Hair Pirates": { name: { fr: "Banquet", en: "Feast" }, bonus: { kind: "berrys", scope: "daily" }, values: [0.15, 0.3, 0.5] },
  "Charlotte Family": { name: { fr: "Thé de la reine", en: "The Queen's Tea Party" }, bonus: { kind: "recruit" }, values: [0.1, 0.2, 0.3] },
  "Big Mom Pirates": { name: { fr: "Totto Land", en: "Totto Land" }, bonus: { kind: "recruit" }, values: [0.1, 0.2, 0.3] },
  "Roger Pirates": { name: { fr: "Laugh Tale", en: "Laugh Tale" }, bonus: { kind: "golden" }, values: [0.2, 0.4, 0.6] },
};
/** Les autres affiliations partagent un trait plus modeste. */
export const DEFAULT_TRAIT: TraitDefinition = { name: { fr: "Esprit d'équipage", en: "Crew Spirit" }, bonus: allGames, values: [0.04, 0.07, 0.1] };

export const traitOf = (org: string): TraitDefinition => TRAITS[org] ?? DEFAULT_TRAIT;

/** Ce qu'un bonus améliore, en clair. */
export function bonusLabel(bonus: BonusKind): Localized {
  if (bonus.kind === "recruit") return { fr: "Chances de recruter après une partie", en: "Chance to recruit after a game" };
  if (bonus.kind === "golden") return { fr: "Chances d'obtenir un avis doré", en: "Chance to get a golden poster" };
  if (bonus.kind === "discount") return { fr: "Réduction à la boutique", en: "Discount at the shop" };
  if (bonus.scope === "all") return { fr: "Berrys sur tous les jeux", en: "Berries on every game" };
  if (bonus.scope === "daily") return { fr: "Berrys sur le défi du jour", en: "Berries on the daily challenge" };
  const scope = bonus.scope;
  const title = GAME_CATEGORIES.find((c) => c.id === scope)?.title ?? { fr: scope, en: scope };
  return { fr: `Berrys sur les jeux « ${title.fr} »`, en: `Berries on “${title.en}” games` };
}

/** Trait d'une affiliation présente dans l'équipage, actif ou non. */
export type CrewTrait = {
  /** Organisation, sous son nom du wiki. */
  org: string;
  /** La même, telle qu'elle s'affiche dans la langue du joueur. */
  affiliation: string;
  name: Localized;
  effect: Localized;
  /** Membres de cette affiliation placés à un poste. */
  count: number;
  /** Palier atteint : 0 (inactif) à 3. */
  level: number;
  /** Bonus du palier atteint, 0 s'il est inactif. */
  value: number;
  /** Bonus de chaque palier, pour l'affichage. */
  values: readonly number[];
};

export function traitFor(org: string, affiliation: string, count: number): CrewTrait {
  const definition = traitOf(org);
  const level = TRAIT_STEPS.filter((step) => count >= step).length;
  return {
    org,
    affiliation,
    name: definition.name,
    effect: bonusLabel(definition.bonus),
    count,
    level,
    value: level > 0 ? definition.values[level - 1] : 0,
    values: definition.values,
  };
}
/** Les dix postes pourvus. */
export const FULL_CREW_BONUS = 0.05;

export type CrewBonuses = {
  berrys: Partial<Record<"all" | "daily" | GameCategoryId, number>>;
  recruit: number;
  golden: number;
  discount: number;
  /** Traits des affiliations présentes dans l'équipage, les plus avancés d'abord. */
  traits: CrewTrait[];
  full: boolean;
};

export function postStrength(character: Recruitable, entry: CollectionEntry | undefined, post: PostId): number {
  const base = STRENGTH_BY_TIER[character.tier] ?? STRENGTH_BY_TIER[4];
  const strength = base * (entry && entry.golden > 0 ? GOLDEN_FACTOR : 1) * (post === "capitaine" ? CAPTAIN_FACTOR : 1);
  return Math.round(strength * 1000) / 1000;
}

export function crewBonuses(
  state: Pick<PlayerState, "crew" | "collection">,
  characterById: ReadonlyMap<string, Recruitable>,
): CrewBonuses {
  const bonuses: CrewBonuses = { berrys: {}, recruit: 0, golden: 0, discount: 0, traits: [], full: false };
  const affiliations = new Map<string, { label: string; count: number }>();
  let filled = 0;

  for (const post of POST_IDS) {
    const id = state.crew[post];
    const character = id ? characterById.get(id) : undefined;
    // Un personnage masqué par le mode spoiler du joueur ne donne pas de bonus
    if (!id || !character || !state.collection[id]) continue;
    filled++;
    if (character.org) {
      const members = affiliations.get(character.org)?.count ?? 0;
      affiliations.set(character.org, { label: character.affiliation ?? character.org, count: members + 1 });
    }

    const strength = postStrength(character, state.collection[id], post);
    const { bonus } = POSTS[post];
    if (bonus.kind === "berrys") bonuses.berrys[bonus.scope] = (bonuses.berrys[bonus.scope] ?? 0) + strength;
    else bonuses[bonus.kind] += strength;
  }

  for (const [org, { label, count }] of affiliations) {
    const trait = traitFor(org, label, count);
    bonuses.traits.push(trait);
    if (trait.level === 0) continue;
    const { bonus } = traitOf(org);
    if (bonus.kind === "berrys") bonuses.berrys[bonus.scope] = (bonuses.berrys[bonus.scope] ?? 0) + trait.value;
    else bonuses[bonus.kind] += trait.value;
  }
  bonuses.traits.sort((a, b) => b.level - a.level || b.count - a.count || a.affiliation.localeCompare(b.affiliation, "fr"));
  if (filled === POST_IDS.length) {
    bonuses.full = true;
    bonuses.berrys.all = (bonuses.berrys.all ?? 0) + FULL_CREW_BONUS;
  }
  return bonuses;
}

/** Bonus de Berrys applicable à une partie : général, plus celui de sa catégorie, plus celui du défi du jour. */
export function berryBonus(bonuses: CrewBonuses, category: GameCategoryId, daily: boolean): number {
  return (bonuses.berrys.all ?? 0) + (bonuses.berrys[category] ?? 0) + (daily ? (bonuses.berrys.daily ?? 0) : 0);
}

export type CrewError = "not-owned" | "unknown-post";

/** Place un personnage à un poste (ou le libère avec `null`). Un personnage n'occupe qu'un poste. */
export function assignPost(state: PlayerState, post: string, characterId: string | null): PlayerState | CrewError {
  if (!(POST_IDS as readonly string[]).includes(post)) return "unknown-post";
  const crew = { ...state.crew };
  if (characterId === null) {
    delete crew[post as PostId];
    return { ...state, crew };
  }
  if (!state.collection[characterId]) return "not-owned";
  for (const other of POST_IDS) if (crew[other] === characterId) delete crew[other];
  crew[post as PostId] = characterId;
  return { ...state, crew };
}
