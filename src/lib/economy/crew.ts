import type { GameCategoryId } from "@/lib/games/catalog";
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
  musicien: { label: "Musicien", effect: "Réduction à la taverne", bonus: { kind: "discount" } },
  timonier: { label: "Timonier", effect: "Chances d'obtenir un avis doré", bonus: { kind: "golden" } },
};

/** Force d'un bonus selon la rareté du personnage placé au poste (1 = légendaire). */
const STRENGTH_BY_TIER: Record<number, number> = { 1: 0.2, 2: 0.14, 3: 0.09, 4: 0.05 };
/** Un avis doré renforce le bonus du poste. */
const GOLDEN_FACTOR = 1.5;
/** Le capitaine agit partout : son bonus est divisé par deux. */
const CAPTAIN_FACTOR = 0.5;
/** Au moins trois membres de la même affiliation. */
export const AFFILIATION_SYNERGY = { members: 3, bonus: 0.1 };
/** Les dix postes pourvus. */
export const FULL_CREW_BONUS = 0.05;

export type CrewBonuses = {
  berrys: Partial<Record<"all" | "daily" | GameCategoryId, number>>;
  recruit: number;
  golden: number;
  discount: number;
  /** Affiliation partagée par au moins trois membres, s'il y en a une. */
  sharedAffiliation: string | null;
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
  const bonuses: CrewBonuses = { berrys: {}, recruit: 0, golden: 0, discount: 0, sharedAffiliation: null, full: false };
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

  const shared = [...affiliations].sort((a, b) => b[1] - a[1])[0];
  if (shared && shared[1] >= AFFILIATION_SYNERGY.members) {
    bonuses.sharedAffiliation = shared[0];
    bonuses.berrys.all = (bonuses.berrys.all ?? 0) + AFFILIATION_SYNERGY.bonus;
  }
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
