import { GAME_CATEGORIES, type GameCategoryId } from "@/lib/games/catalog";
import { POST_IDS, type CollectionEntry, type PlayerState, type PostId, type Recruitable } from "./types";

type BonusKind =
  | { kind: "berrys"; scope: "all" | "daily" | GameCategoryId }
  | { kind: "recruit" }
  | { kind: "golden" }
  | { kind: "discount" };

export const POSTS: Record<PostId, { label: string; effect: string; bonus: BonusKind }> = {
  capitaine: { label: "Capitaine", effect: "Berrys sur tous les jeux", bonus: { kind: "berrys", scope: "all" } },
  sabreur: { label: "Sabreur", effect: "Berrys sur les défis", bonus: { kind: "berrys", scope: "defis" } },
  navigateur: { label: "Navigateur", effect: "Chances de recruter après une partie", bonus: { kind: "recruit" } },
  tireur: { label: "Tireur d'élite", effect: "Berrys sur les jeux « À l'œil »", bonus: { kind: "berrys", scope: "oeil" } },
  cuisinier: { label: "Cuisinier", effect: "Berrys sur le défi du jour", bonus: { kind: "berrys", scope: "daily" } },
  medecin: { label: "Médecin", effect: "Berrys sur les jeux « Savoir »", bonus: { kind: "berrys", scope: "savoir" } },
  archeologue: { label: "Archéologue", effect: "Berrys sur les jeux « Mots et indices »", bonus: { kind: "berrys", scope: "mots" } },
  charpentier: { label: "Charpentier", effect: "Berrys sur les jeux « Primes et mesures »", bonus: { kind: "berrys", scope: "primes" } },
  musicien: { label: "Musicien", effect: "Réduction à la boutique", bonus: { kind: "discount" } },
  timonier: { label: "Timonier", effect: "Chances d'obtenir un avis doré", bonus: { kind: "golden" } },
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

type TraitDefinition = { name: string; bonus: BonusKind; values: readonly [number, number, number] };
const allGames = { kind: "berrys", scope: "all" } as const;
const category = (scope: GameCategoryId) => ({ kind: "berrys", scope }) as const;

/** Trait de chaque grande affiliation (libellé français, comme sur les avis de recherche). */
export const TRAITS: Record<string, TraitDefinition> = {
  "Équipage du Chapeau de paille": { name: "Nakama", bonus: allGames, values: [0.08, 0.14, 0.22] },
  "Équipage de Barbe Blanche": { name: "Fils de Barbe Blanche", bonus: allGames, values: [0.05, 0.09, 0.14] },
  "Armée révolutionnaire": { name: "Vent de révolte", bonus: { kind: "discount" }, values: [0.1, 0.18, 0.25] },
  "Équipage de Barbe Noire": { name: "Pillage", bonus: { kind: "discount" }, values: [0.08, 0.15, 0.22] },
  Marine: { name: "Justice", bonus: category("savoir"), values: [0.1, 0.18, 0.28] },
  "Équipage aux Cent Bêtes": { name: "Loi du plus fort", bonus: category("defis"), values: [0.1, 0.18, 0.28] },
  "Cipher Pol": { name: "Agents de l'ombre", bonus: category("oeil"), values: [0.1, 0.18, 0.28] },
  "Équipage de Don Quijote": { name: "Marionnettes", bonus: category("mots"), values: [0.1, 0.18, 0.28] },
  "Famille Kozuki": { name: "Fourreaux rouges", bonus: category("primes"), values: [0.1, 0.18, 0.28] },
  "Équipage du Roux": { name: "Banquet", bonus: { kind: "berrys", scope: "daily" }, values: [0.15, 0.3, 0.5] },
  "Famille Charlotte": { name: "Thé de la reine", bonus: { kind: "recruit" }, values: [0.1, 0.2, 0.3] },
  "Équipage de Big Mom": { name: "Totto Land", bonus: { kind: "recruit" }, values: [0.1, 0.2, 0.3] },
  "Équipage de Roger": { name: "Laugh Tale", bonus: { kind: "golden" }, values: [0.2, 0.4, 0.6] },
};
/** Les autres affiliations partagent un trait plus modeste. */
export const DEFAULT_TRAIT: TraitDefinition = { name: "Esprit d'équipage", bonus: allGames, values: [0.04, 0.07, 0.1] };

export const traitOf = (affiliation: string): TraitDefinition => TRAITS[affiliation] ?? DEFAULT_TRAIT;

/** Ce qu'un bonus améliore, en clair. */
export function bonusLabel(bonus: BonusKind): string {
  if (bonus.kind === "recruit") return "Chances de recruter après une partie";
  if (bonus.kind === "golden") return "Chances d'obtenir un avis doré";
  if (bonus.kind === "discount") return "Réduction à la boutique";
  if (bonus.scope === "all") return "Berrys sur tous les jeux";
  if (bonus.scope === "daily") return "Berrys sur le défi du jour";
  const scope = bonus.scope;
  return `Berrys sur les jeux « ${GAME_CATEGORIES.find((c) => c.id === scope)?.title ?? scope} »`;
}

/** Trait d'une affiliation présente dans l'équipage, actif ou non. */
export type CrewTrait = {
  affiliation: string;
  name: string;
  effect: string;
  /** Membres de cette affiliation placés à un poste. */
  count: number;
  /** Palier atteint : 0 (inactif) à 3. */
  level: number;
  /** Bonus du palier atteint, 0 s'il est inactif. */
  value: number;
  /** Bonus de chaque palier, pour l'affichage. */
  values: readonly number[];
};

export function traitFor(affiliation: string, count: number): CrewTrait {
  const definition = traitOf(affiliation);
  const level = TRAIT_STEPS.filter((step) => count >= step).length;
  return {
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
  const affiliations = new Map<string, number>();
  let filled = 0;

  for (const post of POST_IDS) {
    const id = state.crew[post];
    const character = id ? characterById.get(id) : undefined;
    // Un personnage masqué par le mode spoiler du joueur ne donne pas de bonus
    if (!id || !character || !state.collection[id]) continue;
    filled++;
    if (character.affiliation) affiliations.set(character.affiliation, (affiliations.get(character.affiliation) ?? 0) + 1);

    const strength = postStrength(character, state.collection[id], post);
    const { bonus } = POSTS[post];
    if (bonus.kind === "berrys") bonuses.berrys[bonus.scope] = (bonuses.berrys[bonus.scope] ?? 0) + strength;
    else bonuses[bonus.kind] += strength;
  }

  for (const [affiliation, count] of affiliations) {
    const trait = traitFor(affiliation, count);
    bonuses.traits.push(trait);
    if (trait.level === 0) continue;
    const { bonus } = traitOf(affiliation);
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
