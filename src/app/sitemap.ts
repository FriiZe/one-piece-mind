import type { MetadataRoute } from "next";
import { LIVE_SLUGS } from "@/lib/games/catalog";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/jeux`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/defis`, changeFrequency: "weekly", priority: 0.6 },
    ...LIVE_SLUGS.map((slug) => ({
      url: `${SITE_URL}/jeux/${slug}`,
      // Le défi du jour change quotidiennement, les autres pages rarement
      changeFrequency: slug === "onepiecedle" ? ("daily" as const) : ("monthly" as const),
      priority: 0.8,
    })),
    { url: `${SITE_URL}/a-propos`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
