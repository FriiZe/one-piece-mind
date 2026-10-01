/**
 * Règles du multijoueur : un salon, un quiz commun, un classement.
 * Calcul pur, partagé par le serveur (qui fait foi) et l'interface.
 */
import { MIX_SLUGS, type MixSlug } from "@/games/qcm/logic";

export const MAX_PLAYERS = 20;
export const QUESTION_COUNTS = [5, 10, 15] as const;
export const ANSWER_SECONDS = [10, 15, 20] as const;
/** Durée d'affichage de la correction avant la question suivante. */
export const REVEAL_SECONDS = 6;
/** Sans nouvelles d'un joueur pendant ce délai, on ne l'attend plus pour passer à la suite. */
export const PRESENCE_SECONDS = 12;

export const DEFAULT_SETTINGS = { questionCount: 10, seconds: 15 } as const;

/** Lettres et chiffres sans ambiguïté à la lecture : ni O ni 0, ni I ni 1. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 5;
export const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export function randomCode(randomInt: (max: number) => number): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

/** Code tel que le joueur le tape : espaces et casse ignorés. */
export function normalizeCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

/** Pseudo d'un invité : 2 à 16 caractères, sans espaces en trop. `null` s'il n'est pas acceptable. */
export function cleanName(input: string): string | null {
  const name = input.normalize("NFKC").replace(/\s+/g, " ").trim();
  // Lettres, chiffres, espaces et quelques signes : pas de caractères de contrôle ni de mise en forme
  if (name.length < 2 || name.length > 16 || !/^[\p{L}\p{N} ._'-]+$/u.test(name)) return null;
  return name;
}

export const nameKey = (name: string) => name.toLowerCase();

export function validGames(slugs: unknown): MixSlug[] | null {
  if (!Array.isArray(slugs) || slugs.length === 0) return null;
  const unique = [...new Set(slugs)];
  return unique.every((slug) => (MIX_SLUGS as readonly string[]).includes(slug)) ? (unique as MixSlug[]) : null;
}

export const MAX_POINTS = 1000;

/**
 * Points d'une réponse : rien si elle est fausse ; sinon 500, plus jusqu'à 500
 * selon la rapidité (tout au début du chrono, plus rien à la fin).
 */
export function pointsFor(correct: boolean, elapsedMs: number, limitMs: number): number {
  if (!correct) return 0;
  const remaining = Math.max(0, Math.min(1, 1 - elapsedMs / limitMs));
  return 500 + Math.round(500 * remaining);
}

export type Ranked<T> = T & { rank: number };

/** Classement : meilleur score d'abord ; à égalité, même rang, le premier arrivé en tête. */
export function rank<T extends { score: number; joinedAt: number }>(players: readonly T[]): Ranked<T>[] {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
  return sorted.map((player, index) => ({
    ...player,
    rank: index > 0 && sorted[index - 1].score === player.score ? sorted.findIndex((p) => p.score === player.score) + 1 : index + 1,
  }));
}

/** Berrys d'une partie parfaite en salon, avant prime de podium. */
const BASE_BERRYS = 600;
const PODIUM_BERRYS: Record<number, number> = { 1: 300, 2: 150, 3: 75 };

/**
 * Berrys gagnés en salon : selon la part des points marqués, plus une prime
 * pour le podium. Un salon à un seul joueur ne rapporte rien.
 */
export function roomBerrys(score: number, questions: number, playerRank: number, players: number): number {
  if (players < 2 || questions <= 0) return 0;
  const performance = Math.min(1, score / (questions * MAX_POINTS));
  const podium = score > 0 ? (PODIUM_BERRYS[playerRank] ?? 0) : 0;
  return Math.round((BASE_BERRYS * performance) / 10) * 10 + podium;
}
