"use client";

import { useDailyKey, useIsClient } from "@/games/ui/storage";
import {
  BASE_BERRYS,
  currentWeek,
  DAILY_CHALLENGE,
  DAILY_CHALLENGE_BERRYS,
  dailyGames,
  daysLeftInWeek,
  weekKey,
  weeklyChallenges,
} from "@/lib/economy";
import { getGame, type GameCategoryId, type LiveSlug } from "@/lib/games/catalog";
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

/** Les trois défis de la semaine, avec l'avancement du joueur. */
export function useWeekly() {
  const { state, status } = usePlayer();
  const isClient = useIsClient();
  const today = useDailyKey();
  const week = weekKey(today);
  const progress = currentWeek(state.week, week);

  return {
    ready: isClient && status !== "loading",
    daysLeft: daysLeftInWeek(today),
    challenges: weeklyChallenges(week).map((challenge, index) => ({
      label: challenge.label,
      target: challenge.target,
      berrys: challenge.berrys,
      slug: challenge.slug,
      value: Math.min(challenge.target, progress.progress[index] ?? 0),
      done: !!progress.done[index],
    })),
  };
}
