import { DEFAULT_LOCALE, LOCALES, localePath, OG_LOCALES, type Locale, type Localized } from "@/lib/i18n";

/** Nom provisoire : le nom et le domaine définitifs restent à choisir (PLAN.md, section 10). */
export const SITE_NAME = "OnePieceMind";
export const SITE_TAGLINE: Localized = { fr: "Les mini-jeux One Piece", en: "One Piece mini-games" };
export const SITE_DESCRIPTION: Localized = {
  fr: "Mini-jeux One Piece gratuits et sans inscription : silhouettes, primes, fruits du démon, quiz et défis quotidiens, avec un mode sans spoiler pour ceux qui suivent l'anime.",
  en: "Free One Piece mini-games, no sign-up needed: silhouettes, bounties, Devil Fruits, quizzes and daily challenges, with a spoiler-free mode for anime watchers.",
};
/**
 * Adresse publique du site, pour les liens canoniques, le plan du site et les
 * images de partage. À défaut de réglage explicite, on prend sur Vercel le
 * domaine de production du projet.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

/**
 * Champs Open Graph communs. Une page qui déclare son propre `openGraph`
 * remplace celui du layout en entier : elle doit donc les reprendre.
 */
export const openGraph = (locale: Locale) => ({ siteName: SITE_NAME, locale: OG_LOCALES[locale], type: "website" }) as const;

/**
 * Adresses d'une même page dans chaque langue : l'adresse canonique est celle
 * de la langue en cours, les autres sont annoncées aux moteurs de recherche
 * (`hreflang`). `path` s'écrit sans langue : `/jeux`.
 */
export function pageAlternates(locale: Locale, path: string) {
  return {
    canonical: localePath(locale, path),
    languages: {
      ...Object.fromEntries(LOCALES.map((other) => [other, localePath(other, path)])),
      "x-default": localePath(DEFAULT_LOCALE, path),
    },
  };
}

/**
 * Métadonnées d'une page indexable : titre, description, adresse canonique,
 * versions dans les autres langues, et leur reprise pour les aperçus de partage.
 */
export function pageMetadata({ locale, title, description, path }: { locale: Locale; title: string; description: string; path: string }) {
  return {
    title,
    description,
    alternates: pageAlternates(locale, path),
    openGraph: { ...openGraph(locale), title, description, url: localePath(locale, path) },
  };
}
