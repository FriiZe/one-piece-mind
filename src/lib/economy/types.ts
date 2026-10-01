/**
 * Économie du jeu : Berrys, collection d'avis de recherche, équipage.
 * Tout ce dossier est du calcul pur, partagé par le navigateur (mode invité)
 * et le serveur (comptes) : les deux appliquent exactement les mêmes règles.
 */
import type { Difficulty } from "@/games/engine/difficulty";
import type { GameCategoryId, LiveSlug } from "@/lib/games/catalog";

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
};

/** Avancement des défis de la semaine (voir weekly.ts). */
export type WeekProgress = {
  /** Semaine concernée, au format « 2026-S40 ». */
  key: string;
  progress: number[];
  done: boolean[];
};

export type PlayerState = {
  berrys: number;
  /** Total gagné depuis le début : c'est lui qui fixe la prime du joueur. */
  lifetimeBerrys: number;
  games: number;
  collection: Record<string, CollectionEntry>;
  crew: Partial<Record<PostId, string>>;
  /** Gains du jour (date de Paris), pour le plafond journalier. */
  day: { key: string; earned: number };
  /** Par jeu. */
  stats: Record<string, GameStats>;
  week: WeekProgress;
};

export const EMPTY_PLAYER: PlayerState = {
  berrys: 0,
  lifetimeBerrys: 0,
  games: 0,
  collection: {},
  crew: {},
  day: { key: "", earned: 0 },
  stats: {},
  week: { key: "", progress: [], done: [] },
};

/** Complète un état enregistré avant l'ajout d'un champ (progression d'invité gardée dans le navigateur). */
export function normalizePlayer(state: Partial<PlayerState> | null | undefined): PlayerState {
  return { ...EMPTY_PLAYER, ...state };
}

/** Ce que l'économie a besoin de savoir d'un personnage. */
export type Recruitable = { id: string; tier: number; affiliation: string | null };

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
export type Milestone = { label: string; berrys: number };

export type Reward = {
  /** Gains de la partie elle-même, bonus d'équipage compris. */
  berrys: number;
  /** Part des gains due aux bonus d'équipage. */
  bonus: number;
  /** Le plafond journalier a réduit les gains. */
  capped: boolean;
  recruit: Recruit | null;
  /** Objectifs du jeu atteints avec cette partie. */
  objectives: Milestone[];
  /** Défis de la semaine terminés avec cette partie. */
  weekly: Milestone[];
  /** Tout ce que la partie a rapporté : gains, objectifs et défis. */
  total: number;
};
