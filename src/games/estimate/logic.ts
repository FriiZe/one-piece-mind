/**
 * Jeux d'estimation : donner un nombre (une prime, un numéro de chapitre) et
 * marquer d'autant plus de points qu'on s'approche de la vraie valeur.
 */
import type { PlayCharacter, ResolvedData } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, sample, type Rng } from "../engine/rng";
import { hasDifficulty } from "@/lib/games/catalog";
import { translator } from "@/lib/i18n";

export const ESTIMATE_LENGTH = 8;
export const POINTS_PER_QUESTION = 5;

/**
 * Barème au numéro près, pour un chapitre ou un épisode : écart maximal toléré
 * à chaque palier, de 10 points (le numéro exact) à 1 point. Le haut du barème
 * est serré, pour récompenser la précision : 9 points jusqu'à 5 numéros d'écart,
 * 8 jusqu'à 10. Il s'élargit ensuite : la moitié des points se garde jusqu'à 61
 * d'écart, pour que celui qui situe à peu près l'arc valide le jeu du jour ;
 * encore 2 points à 99 numéros d'écart, et un dernier jusqu'à 150.
 */
export const NUMBER_BANDS = [0, 5, 10, 25, 42, 61, 74, 86, 99, 150] as const;

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
  /** Barème à l'écart près (voir `NUMBER_BANDS`), à la place du barème proportionnel de l'échelle. */
  bands?: readonly number[];
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

/** Position du curseur, de 0 à 1, qui désigne une valeur : l'inverse de `sliderToValue`. */
export function valueToSlider(question: Pick<EstimateQuestion, "min" | "max" | "scale">, value: number): number {
  const v = Math.min(question.max, Math.max(question.min, value));
  if (question.scale === "linear") return (v - question.min) / (question.max - question.min);
  return (Math.log(v) - Math.log(question.min)) / (Math.log(question.max) - Math.log(question.min));
}

const MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  million: 1e6,
  millions: 1e6,
  md: 1e9,
  mds: 1e9,
  milliard: 1e9,
  milliards: 1e9,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
  billions: 1e9,
};

/**
 * Nombre saisi au clavier : « 1 500 000 000 », « 1,5 md », « 320 M », « 56k »,
 * ou à l'anglaise « 1,500,000,000 », « 1.5 billion ». `null` si la saisie n'est
 * pas un nombre.
 */
export function parseEstimate(text: string): number | null {
  const compact = text
    .toLowerCase()
    .replace(/berr(?:ies|ys?)|฿/g, "")
    .replace(/[\s\u00a0\u202f]/g, "");
  const short = compact.match(/^(\d+(?:[.,]\d+)?)(k|m|md|mds|millions?|milliards?|b|bn|billions?)$/);
  if (short) return Math.round(Number(short[1].replace(",", ".")) * MULTIPLIERS[short[2]]);
  // Sans unité, points et virgules ne peuvent être que des séparateurs de milliers
  if (!/^\d[\d.,']*$/.test(compact)) return null;
  const value = Number(compact.replace(/\D/g, ""));
  return Number.isSafeInteger(value) ? value : null;
}

/** Points d'une estimation parfaite : 5, ou autant que de paliers quand la question a son barème. */
export function maxPoints(question: Pick<EstimateQuestion, "bands">): number {
  return question.bands?.length ?? POINTS_PER_QUESTION;
}

/**
 * Points d'une estimation, de 0 à `maxPoints`. Barème à l'écart près s'il y en
 * a un. Sinon, échelle logarithmique : on juge le rapport entre l'estimation et
 * la vraie valeur ; échelle linéaire : l'écart, rapporté à l'étendue des valeurs possibles.
 */
export function scoreEstimate(question: Pick<EstimateQuestion, "answer" | "min" | "max" | "scale" | "bands">, guess: number): number {
  if (!Number.isFinite(guess) || guess < 0) return 0;
  if (question.bands) {
    const gap = Math.abs(Math.round(guess) - question.answer);
    const index = question.bands.findIndex((limit) => gap <= limit);
    return index === -1 ? 0 : question.bands.length - index;
  }
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

const devineLaPrime: Generator = (rng, data, pool, count) =>
  sample(rng, pool.filter((c) => c.bounty !== null && c.bounty >= MIN_BOUNTY), count).map((c) => ({
    id: c.id,
    title: translator(data.locale)("À combien s'élève sa prime ?", "How much is their bounty?"),
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
  const t = translator(data.locale);
  const byEpisode = data.mode === "anime";
  const known = pool.filter((c) => (byEpisode ? c.episode !== null && c.episode > 0 : c.debut > 0));
  return sample(rng, known, count).map((c) => ({
    id: c.id,
    title: byEpisode
      ? t("Dans quel épisode apparaît-il pour la première fois ?", "In which episode do they first appear?")
      : t("Dans quel chapitre apparaît-il pour la première fois ?", "In which chapter do they first appear?"),
    subject: c.name,
    detail: c.affiliation ?? undefined,
    img: c.img,
    answer: byEpisode ? c.episode! : c.debut,
    min: 1,
    max: byEpisode ? data.latestEpisode : data.latestChapter,
    scale: "linear" as const,
    bands: NUMBER_BANDS,
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

const primeDEquipage: Generator = (rng, data, _pool, count) => {
  const t = translator(data.locale);
  return sample(rng, crewBounties(data.characters), count).map((entry) => ({
    id: entry.crew,
    title: t("Quel est le total des primes connues de ses membres ?", "What do its members' known bounties add up to?"),
    subject: entry.crew,
    detail: t(`${entry.members} membres primés`, `${entry.members} members with a bounty`),
    answer: entry.total,
    min: 10_000_000,
    max: 30_000_000_000,
    scale: "log" as const,
    unit: "berrys" as const,
  }));
};

const GENERATORS = {
  "devine-la-prime": devineLaPrime,
  "premiere-apparition": premiereApparition,
  "prime-d-equipage": primeDEquipage,
} satisfies Record<string, Generator>;

export type EstimateSlug = keyof typeof GENERATORS;
export const ESTIMATE_SLUGS = Object.keys(GENERATORS) as [EstimateSlug, ...EstimateSlug[]];
export const usesDifficulty = (slug: EstimateSlug) => hasDifficulty(slug);

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
  return { score, max: questions.reduce((sum, question) => sum + maxPoints(question), 0) };
}
