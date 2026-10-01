import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Les pages personnelles (profil, navire, salons, quiz des joueurs) restent explorables : c'est leur balise
    // « noindex » qui les écarte des résultats, et un moteur ne la lit que s'il a le droit d'ouvrir la page.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
