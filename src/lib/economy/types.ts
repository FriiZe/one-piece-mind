/**
 * Économie du jeu : Berrys, collection d'avis de recherche, équipage.
 * Tout ce dossier est du calcul pur, partagé par le navigateur (mode invité)
 * et le serveur (comptes) : les deux appliquent exactement les mêmes règles.
 */
import type { Difficulty } from "@/games/engine/difficulty";
import type { GameCategoryId, LiveSlug } from "@/lib/games/catalog";
import type { Localized } from "@/lib/i18n";
import { NO_COSMETICS, sanitizeCosmetics, type CosmeticsState } from "./cosmetics";
import type { DailyStatus } from "./daily";

export const POST_IDS = [
  "capitaine",
  "sabreur",
  "navigateur",
  "tireur",
  "cuisinier",
  "medecin",
  "archeologue",
  "charpentier",
  "musicien",
  "timonier",
] as const;
export type PostId = (typeof POST_IDS)[number];

export type CollectionEntry = {
  /** Nombre d'avis de recherche obtenus, doublons compris. */
  count: number;
  /** Dont avis dorés. */
  golden: number;
};

/** Parcours du joueur sur un jeu : c'est ce que mesurent les objectifs. */
export type GameStats = {
  games: number;
  /** Meilleure réussite, de 0 à 1. */
  best: number;
  /**
   * Meilleure réussite à chaque difficulté, pour les jeux qui en ont : elle
   * fixe la prime des objectifs de score. Absente d'un parcours enregistré
   * avant son ajout, et des jeux sans niveau de difficulté.
   */
  bestBy?: Partial<Record<Difficulty, number>>;
};

/** Avancement d'une série de défis : un compteur et un état par défi, dans l'ordre. */
export type ChallengeProgress = { progress: number[]; done: boolean[] };

/** Avancement des défis de la semaine (voir weekly.ts). */
export type WeekProgress = ChallengeProgress & {
  /** Semaine concernée, au format « 2026-S40 ». */
  key: string;
};

/** Un équipage enregistré : une composition qu'on remet en place d'un geste. */
export type SavedCrew = { id: string; name: string; crew: Partial<Record<PostId, string>> };

export type PlayerState = {
  berrys: number;
  /** Total gagné depuis le début : c'est lui qui fixe la prime du joueur. */
  lifetimeBerrys: number;
  games: number;
  collection: Record<string, CollectionEntry>;
  crew: Partial<Record<PostId, string>>;
  /** Équipages enregistrés, du plus ancien au plus récent (voir crew.ts). */
  savedCrews: SavedCrew[];
  /** Recrues gagnées sans compte, scellées jusqu'à l'inscription (voir guest.ts) ; toujours 0 pour un compte. */
  pendingRecruits: number;
  /**
   * Gains du jour (date de Paris), pour le plafond journalier, jeux du jour
   * déjà validés, et avancement des défis quotidiens (voir dailies.ts).
   */
  day: { key: string; earned: number; done: string[]; challenges: ChallengeProgress };
  /** Par jeu. */
  stats: Record<string, GameStats>;
  week: WeekProgress;
  /** Cosmétiques possédés et portés (voir cosmetics.ts). */
  cosmetics: CosmeticsState;
};

export const EMPTY_PLAYER: PlayerState = {
  berrys: 0,
  lifetimeBerrys: 0,
  games: 0,
  collection: {},
  crew: {},
  savedCrews: [],
  pendingRecruits: 0,
  day: { key: "", earned: 0, done: [], challenges: { progress: [], done: [] } },
  stats: {},
  week: { key: "", progress: [], done: [] },
  cosmetics: NO_COSMETICS,
};

/** Équipages qu'un joueur peut garder de côté, et longueur de leur nom. */
export const SAVED_CREWS_MAX = 5;
export const CREW_NAME_MAX = 24;

export const cleanCrewName = (name: string) => name.replace(/\s+/g, " ").trim();

/** Ne garde d'une liste d'équipages enregistrés que ce qui en a la forme : elle vient d'une colonne JSON ou d'un navigateur. */
export function sanitizeSavedCrews(input: unknown): SavedCrew[] {
  if (!Array.isArray(input)) return [];
  const crews: SavedCrew[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const { id, name, crew } = item as { id?: unknown; name?: unknown; crew?: unknown };
    if (typeof id !== "string" || !id || id.length > 80 || typeof name !== "string" || !crew || typeof crew !== "object") continue;
    const label = cleanCrewName(name).slice(0, CREW_NAME_MAX);
    const posts = POST_IDS.flatMap((post) => {
      const member = (crew as Record<string, unknown>)[post];
      return typeof member === "string" && member && member.length <= 80 ? [[post, member] as const] : [];
    });
    if (!label || !posts.length || crews.some((other) => other.id === id)) continue;
    crews.push({ id, name: label, crew: Object.fromEntries(posts) });
    if (crews.length === SAVED_CREWS_MAX) break;
  }
  return crews;
}

/** Complète un état enregistré avant l'ajout d'un champ (progression d'invité gardée dans le navigateur). */
export function normalizePlayer(state: Partial<PlayerState> | null | undefined): PlayerState {
  return {
    ...EMPTY_PLAYER,
    ...state,
    day: { ...EMPTY_PLAYER.day, ...state?.day },
    savedCrews: sanitizeSavedCrews(state?.savedCrews),
    cosmetics: sanitizeCosmetics(state?.cosmetics?.owned, state?.cosmetics?.equipped),
  };
}

/**
 * Ce que l'économie a besoin de savoir d'un personnage. `org` : son organisation,
 * sous un nom qui ne dépend pas de la langue (c'est elle qui décide des traits
 * d'équipage) ; `affiliation` : la même, telle qu'elle s'affiche.
 */
export type Recruitable = { id: string; tier: number; org: string | null; affiliation: string | null };

/** Résultat d'une partie, tel que le calcule `evaluateReport`. */
export type GameOutcome = {
  slug: LiveSlug;
  category: GameCategoryId;
  score: number;
  max: number;
  /** Réussite de 0 à 1 : c'est elle qui fixe les gains. */
  performance: number;
  difficulty: Difficulty | null;
  /** Défi du jour : gains plus élevés et recrutement assuré en cas de victoire. */
  daily: boolean;
};

export type Recruit = {
  characterId: string;
  golden: boolean;
  /** Le joueur possédait déjà cet avis. */
  duplicate: boolean;
};

/** Prime versée pour un objectif ou un défi atteint à l'occasion d'une partie. */
export type Milestone = { label: Localized; berrys: number };

export type Reward = {
  /** Ce que la partie vaut au regard des jeux du jour : seule une partie `paid` rapporte des Berrys. */
  daily: DailyStatus;
  /** Gains de la partie elle-même, bonus d'équipage compris. */
  berrys: number;
  /** Part des gains due aux bonus d'équipage. */
  bonus: number;
  /** Le plafond journalier a réduit les gains. */
  capped: boolean;
  /** En invité : le plafond des Berrys sans compte a retenu une partie des gains (voir guest.ts). */
  guestCapped?: boolean;
  recruit: Recruit | null;
  /** Objectifs du jeu atteints avec cette partie, ou réussis à une difficulté plus haute. */
  objectives: Milestone[];
  /** Défis quotidiens terminés avec cette partie. */
  dailies: Milestone[];
  /** Défis de la semaine terminés avec cette partie. */
  weekly: Milestone[];
  /** Tout ce que la partie a rapporté : gains, objectifs et défis. */
  total: number;
};
