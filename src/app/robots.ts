import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Les pages personnelles et les points d'accès techniques n'ont rien à faire dans les résultats de recherche
    rules: { userAgent: "*", allow: "/", disallow: ["/profil", "/collection", "/boutique", "/echanges", "/multi/", "/quiz/", "/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
