/**
 * Applique les migrations pendant le build de production sur Vercel, pour que
 * le schéma de la base suive toujours le code déployé. Ne fait rien ailleurs
 * (build local, préversions, site sans base de données).
 */
import { spawnSync } from "node:child_process";

const production = process.env.VERCEL_ENV === "production";
const configured = Boolean(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);

if (!production || !configured) {
  console.log("Migrations : rien à faire (hors production Vercel, ou base non configurée).");
  process.exit(0);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
process.exit(result.status ?? 1);
