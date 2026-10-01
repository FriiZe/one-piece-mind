/**
 * Règles du classé, le « Davy Back Fight » : un duel à un contre un sur un
 * quiz commun, une cote qui monte ou descend selon le résultat, cinq ligues
 * et une saison par mois. Calcul pur, partagé par le serveur (qui fait foi)
 * et l'interface.
 */
import type { Localized } from "@/lib/i18n";

/**
 * Réglages d'un duel : les mêmes pour tous. Les questions s'arrêtent à
 * l'anime, pour que personne ne soit spoilé par un adversaire tiré au hasard.
 */
export const RANKED_SETTINGS = { mode: "anime", difficulty: "normal", questionCount: 10, seconds: 10 } as const;
/** Délai entre la rencontre des deux joueurs et la première question. */
export const COUNTDOWN_SECONDS = 6;

export const START_RATING = 1000;
/** La cote ne descend pas en dessous. */
export const RATING_FLOOR = 100;
/** Ampleur maximale d'une variation de cote. */
const K_FACTOR = 32;

/** Résultat d'un duel pour le premier joueur : 1 (victoire), 0,5 (égalité) ou 0 (défaite). */
export function duelOutcome(score: number, opponentScore: number): 0 | 0.5 | 1 {
  return score > opponentScore ? 1 : score < opponentScore ? 0 : 0.5;
}

/** Variation de cote d'un joueur (formule Elo) : battre plus fort que soi rapporte davantage. */
export function ratingDelta(rating: number, opponentRating: number, outcome: 0 | 0.5 | 1): number {
  const expected = 1 / (1 + 10 ** ((opponentRating - rating) / 400));
  return Math.round(K_FACTOR * (outcome - expected));
}

export const applyDelta = (rating: number, delta: number) => Math.max(RATING_FLOOR, rating + delta);

/**
 * Ligues du classé, de la mer de départ à la dernière île. `berrys` : prime de
 * fin de saison ; `cosmetic` : titre offert à ceux qui y terminent la saison.
 * Les cinq rangs du joueur (Mousse à Empereur) suivent sa prime, pas sa cote :
 * le classé a donc ses propres noms.
 */
export const LEAGUES: readonly { id: string; title: Localized; from: number; berrys: number; cosmetic?: string }[] = [
  { id: "east-blue", title: { fr: "East Blue", en: "East Blue" }, from: 0, berrys: 1000 },
  { id: "reverse-mountain", title: { fr: "Reverse Mountain", en: "Reverse Mountain" }, from: 1100, berrys: 2500 },
  { id: "paradis", title: { fr: "Paradis", en: "Paradise" }, from: 1250, berrys: 5000 },
  { id: "nouveau-monde", title: { fr: "Nouveau Monde", en: "New World" }, from: 1400, berrys: 10_000, cosmetic: "title-nouveau-monde" },
  { id: "laugh-tale", title: { fr: "Laugh Tale", en: "Laugh Tale" }, from: 1600, berrys: 20_000, cosmetic: "title-laugh-tale" },
];
export type League = (typeof LEAGUES)[number];

export function leagueOf(rating: number): { league: League; next: League | null; progress: number } {
  const index = Math.max(0, LEAGUES.findLastIndex((league) => rating >= league.from));
  const league = LEAGUES[index];
  const next = LEAGUES[index + 1] ?? null;
  return { league, next, progress: next ? Math.min(1, Math.max(0, (rating - league.from) / (next.from - league.from))) : 1 };
}

/** Saison d'un jour « AAAA-MM-JJ » : le mois, à l'heure de Paris. */
export const seasonKey = (dayKey: string) => dayKey.slice(0, 7);

/** Jours restants avant la fin de la saison, jour en cours compris. */
export function seasonDaysLeft(dayKey: string): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  // Le jour 0 du mois suivant est le dernier jour du mois en cours
  return new Date(Date.UTC(year, month, 0)).getUTCDate() - day + 1;
}

/** Duels à jouer dans une saison pour en toucher la prime. */
export const SEASON_MIN_GAMES = 5;

export type RankedProfile = { season: string; rating: number; games: number; wins: number };
export type SeasonResult = { season: string; rating: number; games: number; wins: number; berrys: number; cosmetic: string | null };

/**
 * Passage à une nouvelle saison : la saison précédente est soldée (prime de la
 * ligue atteinte, pour qui a assez joué), et la cote est ramenée à mi-chemin
 * de la cote de départ. `result` est nul si le joueur n'avait pas joué.
 */
export function rollSeason(profile: RankedProfile, season: string): { profile: RankedProfile; result: SeasonResult | null } {
  if (profile.season === season) return { profile, result: null };
  const played = profile.season !== "" && profile.games > 0;
  const rewarded = played && profile.games >= SEASON_MIN_GAMES;
  const { league } = leagueOf(profile.rating);
  return {
    profile: {
      season,
      rating: played ? Math.round((profile.rating + START_RATING) / 2) : START_RATING,
      games: 0,
      wins: 0,
    },
    result: played
      ? {
          season: profile.season,
          rating: profile.rating,
          games: profile.games,
          wins: profile.wins,
          berrys: rewarded ? league.berrys : 0,
          cosmetic: rewarded ? (league.cosmetic ?? null) : null,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// File d'attente

/** Sans nouvelles d'un joueur en file pendant ce délai, on ne le propose plus à personne. */
export const QUEUE_PRESENCE_SECONDS = 8;
/** Rythme auquel un joueur en file interroge le serveur. */
export const QUEUE_POLL_MS = 2000;
/** Duels classés entre les deux mêmes joueurs par jour : au-delà, la file ne les réunit plus. */
export const MAX_PAIR_DUELS_PER_DAY = 5;

/**
 * Écart de cote accepté entre deux joueurs : serré au début, il s'élargit avec
 * l'attente, et disparaît au bout d'une demi-minute. Mieux vaut un duel
 * déséquilibré, que la formule de cote compense, que pas de duel du tout.
 */
export function ratingWindow(waitedMs: number): number {
  if (waitedMs >= 30_000) return Infinity;
  return 100 + 50 * Math.floor(Math.max(0, waitedMs) / 5000);
}

/** Deux joueurs en file peuvent-ils s'affronter ? Le plus patient des deux décide de l'écart toléré. */
export function canPair(ratingA: number, waitedA: number, ratingB: number, waitedB: number): boolean {
  return Math.abs(ratingA - ratingB) <= Math.max(ratingWindow(waitedA), ratingWindow(waitedB));
}
