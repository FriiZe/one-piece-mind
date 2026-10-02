/**
 * Défis quotidiens : quatre défis, les mêmes pour tous les joueurs, tirés chaque
 * jour (heure de Paris) à partir de la date. Ils s'ajoutent aux jeux du jour :
 * leur prime est versée à la fin de la partie qui les termine.
 */
import { createRng, pick, randomInt, seedFromString } from "@/games/engine/rng";
import { GAME_CATEGORIES, GAMES, getGame, isRewardless } from "@/lib/games/catalog";
import { dailyGames } from "./daily";
import type { ChallengeProgress } from "./types";
import { isScoreChallengeGame, playChallenge, scoreChallenge, type Challenge } from "./weekly";

export function dailyChallenges(dayKey: string): Challenge[] {
  const rng = createRng(seedFromString(`quotidiens:${dayKey}`));
  const playable = GAMES.filter((game) => game.status === "live" && !isRewardless(game.slug));
  const selection = dailyGames(dayKey).map((slug) => getGame(slug)!);
  // Une catégorie qui a des jeux récompensés, pour le défi « jouer dans une catégorie »
  const category = pick(rng, GAME_CATEGORIES.filter((entry) => playable.some((game) => game.category === entry.id)));

  // Un jeu de la sélection du jour : la partie qui réussit le défi peut aussi le valider. S'il n'y
  // en a aucun où 80 % se joue vraiment, la barre descend à la moitié des points
  const scorable = selection.filter(isScoreChallengeGame);
  const featured = pick(rng, scorable.length ? scorable : selection);

  // Un objectif d'un jeu hors sélection, pour aller voir ailleurs : y jouer, y marquer 80 %, y réussir un sans-faute
  const elsewhere = playable.filter((game) => !selection.includes(game));
  const kind = randomInt(rng, 3);
  const other = pick(rng, kind === 0 ? elsewhere : elsewhere.filter(isScoreChallengeGame));

  return [
    // Un jour sur deux : jouer, tout simplement, ou jouer dans une catégorie
    randomInt(rng, 2) === 0
      ? {
          label: { fr: "Jouer 3 parties", en: "Play 3 games" },
          target: 3,
          berrys: 300,
          advance: () => 1,
        }
      : {
          label: {
            fr: `Jouer 2 parties dans la catégorie « ${category.title.fr} »`,
            en: `Play 2 games in the “${category.title.en}” category`,
          },
          target: 2,
          berrys: 300,
          advance: (outcome) => (outcome.category === category.id ? 1 : 0),
        },
    {
      label: { fr: "Valider 3 jeux du jour", en: "Clear 3 daily games" },
      target: 3,
      berrys: 600,
      advance: (_outcome, { paid }) => (paid ? 1 : 0),
    },
    scorable.length ? scoreChallenge(featured, 0.8, 500) : scoreChallenge(featured, 0.5, 300),
    kind === 0 ? playChallenge(other, 2, 200) : kind === 1 ? scoreChallenge(other, 0.8, 500) : scoreChallenge(other, 1, 800),
  ];
}

/** Avancement du joueur pour le jour donné : celui d'un autre jour est remis à zéro. */
export function currentDay(day: { key: string; challenges?: ChallengeProgress }, dayKey: string): ChallengeProgress {
  const count = dailyChallenges(dayKey).length;
  if (day.key === dayKey && day.challenges?.progress.length === count) return day.challenges;
  return { progress: Array(count).fill(0), done: Array(count).fill(false) };
}
