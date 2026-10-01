/**
 * Langues du site. Le français est servi à la racine (`/jeux`), l'anglais sous
 * `/en` (`/en/jeux`) : les adresses françaises ne changent pas. Tout ce qui est
 * ici est du calcul pur, partagé par le serveur, le navigateur et les tests.
 */
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

export const isLocale = (value: unknown): value is Locale => (LOCALES as readonly unknown[]).includes(value);

/** Une valeur par langue : un texte, ou une table de libellés. */
export type Localized<T = string> = Record<Locale, T>;

/** Nom de chaque langue, dans cette langue. */
export const LOCALE_NAMES: Localized = { fr: "Français", en: "English" };

/** Langue telle que l'attendent `Intl` et les méthodes `toLocale…`. */
export const INTL_LOCALES: Localized = { fr: "fr-FR", en: "en-US" };
/** Langue telle que l'attend Open Graph. */
export const OG_LOCALES: Localized = { fr: "fr_FR", en: "en_US" };

/**
 * Choisit entre un texte français et sa traduction : `t("Jouer", "Play")`.
 * Les deux textes sont écrits côte à côte, là où ils servent.
 */
export type Translate = <T>(fr: T, en: T) => T;

export function translator(locale: Locale): Translate {
  return (fr, en) => (locale === "en" ? en : fr);
}

/** Adresse d'une page du site dans une langue : `/jeux` reste `/jeux` en français, devient `/en/jeux` en anglais. */
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  // L'accueil, seul ou suivi d'une ancre ou de paramètres : `/en`, `/en#jeux-du-jour`
  return path === "/" || path.startsWith("/#") || path.startsWith("/?") ? `/${locale}${path.slice(1)}` : `/${locale}${path}`;
}

/**
 * Langue d'une adresse et chemin sans son préfixe : `/en/jeux` donne `en` et `/jeux`.
 * Le préfixe `/fr` est reconnu lui aussi : c'est sous cette adresse interne que
 * les pages françaises sont rendues côté serveur (voir src/proxy.ts), alors que
 * le navigateur, lui, voit `/jeux`.
 */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  for (const locale of LOCALES) {
    if (pathname === `/${locale}`) return { locale, path: "/" };
    if (pathname.startsWith(`/${locale}/`)) return { locale, path: pathname.slice(locale.length + 1) };
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}

/** Cookie qui retient la langue choisie avec le sélecteur : il prime sur la langue du navigateur. */
export const LOCALE_COOKIE = "opm_lang";

/**
 * Langue préférée d'un navigateur d'après son en-tête `Accept-Language`,
 * parmi celles du site ; la langue par défaut si aucune ne convient.
 */
export function preferredLocale(acceptLanguage: string | null): Locale {
  const wanted = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, quality] = part.trim().split(";q=");
      return { language: tag.toLowerCase().split("-")[0], quality: quality === undefined ? 1 : Number(quality) || 0 };
    })
    .filter((entry) => entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);
  return wanted.map((entry) => entry.language).find(isLocale) ?? DEFAULT_LOCALE;
}
