/** Nom provisoire : le nom et le domaine définitifs restent à choisir (PLAN.md, section 10). */
export const SITE_NAME = "OnePieceMind";
export const SITE_TAGLINE = "Les mini-jeux One Piece";
export const SITE_DESCRIPTION =
  "Mini-jeux One Piece gratuits et sans inscription : silhouettes, primes, fruits du démon, quiz et défis quotidiens, avec un mode sans spoiler pour ceux qui suivent l'anime.";
/**
 * Adresse publique du site, pour les liens canoniques, le plan du site et les
 * images de partage. À défaut de réglage explicite, on prend sur Vercel le
 * domaine de production du projet.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
