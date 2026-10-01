/** Mise en forme de l'administration. Les dates sont toujours à l'heure de Paris, comme les jeux du jour. */
import { getGame } from "@/lib/games/catalog";
import { INTL_LOCALES, type Locale } from "@/lib/i18n";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const formatter = (locale: Locale, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(INTL_LOCALES[locale], { timeZone: "Europe/Paris", ...options });

/** « 1 oct. 2026 ». */
export function formatDate(date: Date, locale: Locale): string {
  return formatter(locale, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** « 1 oct. 2026, 21:40 ». */
export function formatDateTime(date: Date, locale: Locale): string {
  return formatter(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Un jour AAAA-MM-JJ en clair : « 1 oct. », ou « jeudi 1 octobre » en version longue. */
export function formatDay(day: string, locale: Locale, long = false): string {
  const options: Intl.DateTimeFormatOptions = long ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "short" };
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], { timeZone: "UTC", ...options }).format(new Date(`${day}T00:00:00Z`));
}

/** « il y a 3 heures » ; au-delà d'un mois, la date. */
export function formatAgo(date: Date, locale: Locale, now = Date.now()): string {
  const elapsed = Math.max(0, now - date.getTime());
  if (elapsed >= 30 * DAY) return formatDate(date, locale);
  const relative = new Intl.RelativeTimeFormat(INTL_LOCALES[locale], { numeric: "auto" });
  if (elapsed < MINUTE) return relative.format(0, "minute");
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), "hour");
  return relative.format(-Math.floor(elapsed / DAY), "day");
}

/** Graduations d'un axe qui part de zéro : des nombres ronds, quatre intervalles au plus. */
export function axisTicks(max: number): number[] {
  let step = 1;
  // Plus petit pas parmi 1, 2, 5, 10, 20, 50… qui couvre `max` en quatre intervalles
  for (let power = 1; step * 4 < max; power *= 10) {
    step = [1, 2, 5].map((factor) => factor * power).find((candidate) => candidate * 4 >= max) ?? 5 * power;
  }
  const count = Math.max(1, Math.ceil(max / step));
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

/** Titre d'un jeu d'après l'identifiant enregistré avec une partie ; `-daily` désigne sa version du jour. */
export function gameTitle(slug: string, locale: Locale): string {
  const daily = slug.endsWith("-daily");
  const title = getGame(daily ? slug.slice(0, -"-daily".length) : slug)?.title[locale] ?? slug;
  if (!daily) return title;
  return locale === "en" ? `${title} (daily)` : `${title} (du jour)`;
}
