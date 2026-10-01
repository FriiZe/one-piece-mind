/** Défi du jour : la journée change à minuit, heure de Paris, pour tout le monde. */

const DAY_MS = 86_400_000;
/** Premier jour du défi : il porte le numéro 1. */
const EPOCH = "2026-10-01";

const parisDate = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function dailyKey(now: Date = new Date()): string {
  return parisDate.format(now);
}

/** Numéro du défi : 1 le jour du lancement, puis +1 par jour. */
export function dailyNumber(key: string): number {
  return Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${EPOCH}T00:00:00Z`)) / DAY_MS) + 1;
}

/** Les deux clés désignent-elles deux jours consécutifs ? */
export function isNextDay(previous: string, current: string): boolean {
  return dailyNumber(current) - dailyNumber(previous) === 1;
}
