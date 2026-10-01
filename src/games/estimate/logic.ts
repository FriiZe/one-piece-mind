/**
 * Jeux d'estimation : donner un nombre (une prime, un numéro de chapitre) et
 * marquer d'autant plus de points qu'on s'approche de la vraie valeur.
 */
import type { PlayCharacter, ResolvedData } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, sample, type Rng } from "../engine/rng";

export const ESTIMATE_LENGTH = 8;
export const POINTS_PER_QUESTION = 5;
export const MAX_SCORE = ESTIMATE_LENGTH * POINTS_PER_QUESTION;

export type EstimateQuestion = {
  id: string;
  title: string;
  subject: string;
  detail?: string;
  img?: string | null;
  answer: number;
  min: number;
  max: number;
  /** `log` : les valeurs s'étalent sur plusieurs ordres de grandeur (primes). */
  scale: "log" | "linear";
  unit: "berrys" | "chapitre" | "épisode";
};

/** Valeur désignée par une position du curseur, de 0 à 1. */
export function sliderToValue(question: Pick<EstimateQuestion, "min" | "max" | "scale">, position: number): number {
  const t = Math.min(1, Math.max(0, position));
  if (question.scale === "linear") return Math.round(question.min + t * (question.max - question.min));
  const raw = Math.exp(Math.log(question.min) + t * (Math.log(question.max) - Math.log(question.min)));
  // Deux chiffres significatifs : personne n'estime une prime au Berry près
  const magnitude = 10 ** (Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / magnitude) * magnitude;
}

/**
 * Points d'une estimation, de 0 à 5. Échelle logarithmique : on juge le
 * rapport entre l'estimation et la vraie valeur. Échelle linéaire : l'écart,
 * rapporté à l'étendue des valeurs possibles.
 */
export function scoreEstimate(question: Pick<EstimateQuestion, "answer" | "min" | "max" | "scale">, guess: number): number {
  if (!Number.isFinite(guess) || guess < 0) return 0;
  if (question.scale === "log") {
    if (guess <= 0) return 0;
    const ratio = Math.max(guess / question.answer, question.answer / guess);
    const steps = [1.1, 1.25, 1.5, 2, 3];
    const index = steps.findIndex((limit) => ratio <= limit);
    return index === -1 ? 0 : POINTS_PER_QUESTION - index;
  }
  const error = Math.abs(guess - question.answer) / (question.max - question.min);
  const steps = [0.01, 0.03, 0.06, 0.1, 0.2];
  const index = steps.findIndex((limit) => error <= limit);
  return index === -1 ? 0 : POINTS_PER_QUESTION - index;
}

type Generator = (rng: Rng, data: ResolvedData, pool: readonly PlayCharacter[], count: number) => EstimateQuestion[];

const MIN_BOUNTY = 1_000_000;

const devineLaPrime: Generator = (rng, _data, pool, count) =>
  sample(rng, pool.filter((c) => c.bounty !== null && c.bounty >= MIN_BOUNTY), count).map((c) => ({
    id: c.id,
    title: "À combien s'élève sa prime ?",
    subject: c.name,
    detail: c.affiliation ?? undefined,
    img: c.img,
    answer: c.bounty!,
    min: MIN_BOUNTY,
    max: 6_000_000_000,
    scale: "log" as const,
    unit: "berrys" as const,
  }));

const premiereApparition: Generator = (rng, data, pool, count) => {
  // Un joueur qui suit l'anime compte en épisodes, un lecteur du manga en chapitres
  const byEpisode = data.mode === "anime";
  const known = pool.filter((c) => (byEpisode ? c.episode !== null && c.episode > 0 : c.debut > 0));
  return sample(rng, known, count).map((c) => ({
    id: c.id,
    title: byEpisode ? "Dans quel épisode apparaît-il pour la première fois ?" : "Dans quel chapitre apparaît-il pour la première fois ?",
    subject: c.name,
    detail: c.affiliation ?? undefined,
    img: c.img,
    answer: byEpisode ? c.episode! : c.debut,
    min: 1,
    max: byEpisode ? data.latestEpisode : data.latestChapter,
    scale: "linear" as const,
    unit: byEpisode ? ("épisode" as const) : ("chapitre" as const),
  }));
};

/** Total des primes connues des membres de chaque organisation qui en compte au moins trois. */
export function crewBounties(characters: readonly PlayCharacter[]): { crew: string; total: number; members: number }[] {
  const totals = new Map<string, { total: number; members: number }>();
  for (const c of characters) {
    if (!c.affiliation || c.bounty === null) continue;
    const entry = totals.get(c.affiliation) ?? { total: 0, members: 0 };
    totals.set(c.affiliation, { total: entry.total + c.bounty, members: entry.members + 1 });
  }
  return [...totals]
    .filter(([, entry]) => entry.members >= 3)
    .map(([crew, entry]) => ({ crew, ...entry }))
    .sort((a, b) => a.crew.localeCompare(b.crew, "fr"));
}

const primeDEquipage: Generator = (rng, data, _pool, count) =>
  sample(rng, crewBounties(data.characters), count).map((entry) => ({
    id: entry.crew,
    title: "Quel est le total des primes connues de ses membres ?",
    subject: entry.crew,
    detail: `${entry.members} membres primés`,
    answer: entry.total,
    min: 10_000_000,
    max: 30_000_000_000,
    scale: "log" as const,
    unit: "berrys" as const,
  }));

const GENERATORS = {
  "devine-la-prime": devineLaPrime,
  "premiere-apparition": premiereApparition,
  "prime-d-equipage": primeDEquipage,
} satisfies Record<string, Generator>;

export type EstimateSlug = keyof typeof GENERATORS;
export const ESTIMATE_SLUGS = Object.keys(GENERATORS) as [EstimateSlug, ...EstimateSlug[]];
export const usesDifficulty = (slug: EstimateSlug) => slug !== "prime-d-equipage";

export function generateEstimates(slug: EstimateSlug, seed: number, difficulty: Difficulty, data: ResolvedData): EstimateQuestion[] {
  return GENERATORS[slug](createRng(seed), data, byDifficulty(data.characters, difficulty), ESTIMATE_LENGTH);
}

/** Rejoue une partie à partir de sa graine et des estimations données. */
export function evaluate(slug: EstimateSlug, seed: number, difficulty: Difficulty, answers: readonly number[], data: ResolvedData) {
  const questions = generateEstimates(slug, seed, difficulty, data);
  const score = questions.reduce(
    (sum, question, index) => sum + (index in answers ? scoreEstimate(question, answers[index]) : 0),
    0,
  );
  return { score, max: questions.length * POINTS_PER_QUESTION };
}
