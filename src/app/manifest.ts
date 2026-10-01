import type { MetadataRoute } from "next";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

/**
 * Permet d'ajouter le site à l'écran d'accueil. Sur iPhone et iPad, c'est la
 * condition pour recevoir les notifications push.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION[DEFAULT_LOCALE],
    // La langue est choisie à l'arrivée, comme pour toute visite (src/proxy.ts)
    start_url: "/",
    display: "standalone",
    background_color: "#0b1a2b",
    theme_color: "#0b1a2b",
    icons: [
      { src: "/images/app/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/images/app/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
