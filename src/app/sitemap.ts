import type { MetadataRoute } from "next";
import { LIVE_SLUGS } from "@/lib/games/catalog";
import { LOCALES, localePath } from "@/lib/i18n";
import { pageAlternates, SITE_URL } from "@/lib/site";

type Page = Pick<MetadataRoute.Sitemap[number], "changeFrequency" | "priority"> & { path: string };

const PAGES: Page[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/jeux", changeFrequency: "weekly", priority: 0.9 },
  { path: "/defis", changeFrequency: "weekly", priority: 0.6 },
  { path: "/multi", changeFrequency: "monthly", priority: 0.7 },
  { path: "/classe", changeFrequency: "monthly", priority: 0.6 },
  { path: "/raid", changeFrequency: "weekly", priority: 0.6 },
  { path: "/quiz", changeFrequency: "daily", priority: 0.7 },
  ...LIVE_SLUGS.map((slug) => ({
    path: `/jeux/${slug}`,
    // Le défi du jour change quotidiennement, les autres pages rarement
    changeFrequency: slug === "onepiecedle" ? ("daily" as const) : ("monthly" as const),
    priority: 0.8,
  })),
  { path: "/a-propos", changeFrequency: "yearly", priority: 0.2 },
];

/** Chaque page figure une fois par langue, avec le renvoi vers ses autres versions (`hreflang`). */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ path, ...page }) => {
    const languages = Object.fromEntries(
      Object.entries(pageAlternates(LOCALES[0], path).languages).map(([language, href]) => [language, `${SITE_URL}${href}`]),
    );
    return LOCALES.map((locale) => ({ url: `${SITE_URL}${localePath(locale, path)}`, ...page, alternates: { languages } }));
  });
}
