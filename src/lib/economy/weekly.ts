/**
 * Défis de la semaine : trois défis, les mêmes pour tous les joueurs, tirés
 * chaque lundi à partir du numéro de la semaine.
 */
import { createRng, sample, seedFromString } from "@/games/engine/rng";
import { GAMES, type LiveSlug } from "@/lib/games/catalog";
import type { GameOutcome, WeekProgress } from "./types";

export type Challenge = {
  label: string;
  target: number;
  berrys: number;
  /** De combien cette partie fait avancer le défi. */
  advance: (outcome: GameOutcome, earned: number) => number;
  /** Jeu concerné, pour proposer un lien. */
  slug?: LiveSlug;
};

/** Semaine ISO d'une date « AAAA-MM-JJ » : elle commence le lundi. */
export function weekKey(dayKey: string): string {
  const DAY = 86_400_000;
  const mondayBased = (date: Date) => (date.getUTCDay() + 6) % 7;
  // Le jeudi de la semaine décide de l'année à laquelle elle appartient
  const day = new Date(`${dayKey}T00:00:00Z`);
  const thursday = new Date(day.getTime() + (3 - mondayBased(day)) * DAY);
  // La première semaine de l'année est celle qui contient le 4 janvier
  const january4 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const firstThursday = january4.getTime() + (3 - mondayBased(january4)) * DAY;
  const week = 1 + Math.round((thursday.getTime() - firstThursday) / (7 * DAY));
  return `${thursday.getUTCFullYear()}-S${String(week).padStart(2, "0")}`;
}

/** Jours restants avant le prochain lundi, jour en cours compris. */
export function daysLeftInWeek(dayKey: string): number {
  const weekday = (new Date(`${dayKey}T00:00:00Z`).getUTCDay() + 6) % 7;
  return 7 - weekday;
}

export function weeklyChallenges(week: string): Challenge[] {
  const rng = createRng(seedFromString(`defis:${week}`));
  const live = GAMES.filter((game) => game.status === "live");
  const [regular, skilled] = sample(rng, live, 2);
  const weekNumber = Number(week.split("-S")[1]);

  return [
    {
      label: `Jouer 5 parties de « ${regular.title} »`,
      target: 5,
      berrys: 1500,
      slug: regular.slug as LiveSlug,
      advance: (outcome) => (outcome.slug === regular.slug ? 1 : 0),
    },
    {
      label: `Marquer 80 % des points dans « ${skilled.title} »`,
      target: 1,
      berrys: 2000,
      slug: skilled.slug as LiveSlug,
      advance: (outcome) => (outcome.slug === skilled.slug && outcome.performance >= 0.8 ? 1 : 0),
    },
    // Une semaine sur deux : le défi du jour, ou les gains
    weekNumber % 2 === 0
      ? {
          label: "Réussir 3 défis du jour",
          target: 3,
          berrys: 2500,
          slug: "onepiecedle",
          advance: (outcome) => (outcome.daily && outcome.performance > 0 ? 1 : 0),
        }
      : {
          label: "Gagner 5 000 Berrys en jouant",
          target: 5000,
          berrys: 1500,
          advance: (_outcome, earned) => earned,
        },
  ];
}

/** Avancement du joueur pour la semaine donnée : celui d'une semaine passée est remis à zéro. */
export function currentWeek(progress: WeekProgress | undefined, week: string): WeekProgress {
  const count = weeklyChallenges(week).length;
  if (progress?.key === week && progress.progress.length === count) return progress;
  return { key: week, progress: Array(count).fill(0), done: Array(count).fill(false) };
}
