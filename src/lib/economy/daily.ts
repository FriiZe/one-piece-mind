/**
 * Jeux du jour : chaque jour (heure de Paris), cinq jeux tirés au hasard, les
 * mêmes pour tous les joueurs. Avec le défi du jour (OnePiecedle), ce sont les
 * seuls à rapporter des Berrys et des recrues, une fois chacun, à condition de
 * réussir la partie. Les autres jeux se jouent pour le plaisir, les objectifs
 * et les défis de la semaine.
 */
import { createRng, sample, seedFromString } from "@/games/engine/rng";
import { GAMES, isRewardless, type LiveSlug } from "@/lib/games/catalog";

export const DAILY_GAMES = 5;
/** Réussite à partir de laquelle un jeu du jour est validé : la moitié des points. */
export const DAILY_PASS = 0.5;
/** Nom du défi du jour dans la liste des jeux validés (son jeu, OnePiecedle, n'est jamais tiré). */
export const DAILY_CHALLENGE = "defi-du-jour";

/** Ce qu'une partie vaut au regard des jeux du jour. */
export type DailyStatus =
  /** Jeu du jour validé par cette partie : elle est payée. */
  | "paid"
  /** Jeu qui n'est pas dans la sélection du jour. */
  | "off"
  /** Jeu du jour déjà validé aujourd'hui. */
  | "done"
  /** Jeu du jour, mais la partie n'atteint pas la moitié des points. */
  | "missed";

export function dailyGames(dayKey: string): LiveSlug[] {
  const candidates = GAMES.filter((game) => game.status === "live" && !isRewardless(game.slug) && game.slug !== "onepiecedle");
  return sample(createRng(seedFromString(`jeux-du-jour:${dayKey}`)), candidates, DAILY_GAMES).map((game) => game.slug as LiveSlug);
}

/** Statut d'une partie : `daily` désigne le défi du jour, qui se valide en trouvant le personnage. */
export function dailyStatus(
  slug: LiveSlug,
  daily: boolean,
  performance: number,
  dayKey: string,
  doneToday: readonly string[],
): DailyStatus {
  if (!daily && !dailyGames(dayKey).includes(slug)) return "off";
  if (doneToday.includes(daily ? DAILY_CHALLENGE : slug)) return "done";
  return (daily ? performance > 0 : performance >= DAILY_PASS) ? "paid" : "missed";
}
