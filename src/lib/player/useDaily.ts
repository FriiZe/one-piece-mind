"use client";

import { useDailyKey, useIsClient } from "@/games/ui/storage";
import {
  BASE_BERRYS,
  currentDay,
  currentWeek,
  DAILY_CHALLENGE,
  dailyChallenges,
  DAILY_CHALLENGE_BERRYS,
  dailyGames,
  daysLeftInWeek,
  weekKey,
  weeklyChallenges,
  type Challenge,
  type ChallengeProgress,
} from "@/lib/economy";
import { getGame, hasDifficulty, type GameCategoryId, type LiveSlug } from "@/lib/games/catalog";
import type { Localized } from "@/lib/i18n";
import { usePlayer } from "./PlayerProvider";

export type DailyEntry = {
  /** Nom dans la liste des jeux validés du jour. */
  key: string;
  slug: LiveSlug;
  href: string;
  title: Localized;
  pitch: Localized;
  category: GameCategoryId;
  berrys: number;
  /** Le défi du jour, à part des cinq jeux tirés. */
  challenge: boolean;
  done: boolean;
};

/**
 * Les jeux du jour du joueur : le défi du jour puis les jeux tirés, avec ceux
 * qu'il a déjà validés. La sélection dépend de la date : `ready` reste faux
 * tant que le navigateur ne la connaît pas.
 */
export function useDaily() {
  const { state, status } = usePlayer();
  const isClient = useIsClient();
  const today = useDailyKey();
  const done = state.day.key === today ? state.day.done : [];

  const onepiecedle = getGame("onepiecedle")!;
  const entries: DailyEntry[] = [
    {
      key: DAILY_CHALLENGE,
      slug: "onepiecedle",
      href: "/jeux/onepiecedle",
      title: onepiecedle.title,
      pitch: { fr: "Le personnage mystère, le même pour tous les joueurs.", en: "The mystery character, the same for every player." },
      category: onepiecedle.category,
      berrys: DAILY_CHALLENGE_BERRYS,
      challenge: true,
      done: done.includes(DAILY_CHALLENGE),
    },
    ...dailyGames(today).map((slug) => {
      const game = getGame(slug)!;
      return {
        key: slug,
        slug,
        href: `/jeux/${slug}`,
        title: game.title,
        pitch: game.pitch,
        category: game.category,
        berrys: BASE_BERRYS[slug],
        challenge: false,
        done: done.includes(slug),
      };
    }),
  ];

  return {
    ready: isClient && status !== "loading",
    today,
    entries,
    total: entries.length,
    count: entries.filter((entry) => entry.done).length,
  };
}

/** Un défi tel qu'il s'affiche : son avancement, et si sa prime suit la difficulté. */
export type ChallengeView = {
  label: Localized;
  target: number;
  berrys: number;
  slug?: LiveSlug;
  /** Défi de score sur un jeu qui a des niveaux : la prime dépend de la difficulté de la partie. */
  scaled: boolean;
  value: number;
  done: boolean;
};

function views(challenges: Challenge[], progress: ChallengeProgress): ChallengeView[] {
  return challenges.map((challenge, index) => ({
    label: challenge.label,
    target: challenge.target,
    berrys: challenge.berrys,
    slug: challenge.slug,
    scaled: !!challenge.scaled && !!challenge.slug && hasDifficulty(challenge.slug),
    value: Math.min(challenge.target, progress.progress[index] ?? 0),
    done: !!progress.done[index],
  }));
}

/** Les quatre défis quotidiens, avec l'avancement du joueur. */
export function useDailyChallenges() {
  const { state, status } = usePlayer();
  const isClient = useIsClient();
  const today = useDailyKey();
  return {
    ready: isClient && status !== "loading",
    challenges: views(dailyChallenges(today), currentDay(state.day, today)),
  };
}

/** Les six défis de la semaine, avec l'avancement du joueur. */
export function useWeekly() {
  const { state, status } = usePlayer();
  const isClient = useIsClient();
  const today = useDailyKey();
  const week = weekKey(today);

  return {
    ready: isClient && status !== "loading",
    daysLeft: daysLeftInWeek(today),
    challenges: views(weeklyChallenges(week), currentWeek(state.week, week)),
  };
}
