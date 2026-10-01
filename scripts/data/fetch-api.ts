/**
 * Télécharge les données brutes d'api-onepiece.com dans data/raw/api/.
 * Usage : npm run data:fetch-api
 */
import path from "node:path";
import { RAW_DIR, fetchJson, writeJson } from "./lib/io";

const BASE = "https://api.api-onepiece.com/v2";
const ENDPOINTS = [
  "characters",
  "fruits",
  "crews",
  "sagas",
  "arcs",
  "episodes",
  "chapters",
  "boats",
  "swords",
  "locates",
] as const;
const LANGS = ["fr", "en"] as const;

async function main() {
  for (const endpoint of ENDPOINTS) {
    for (const lang of LANGS) {
      const data = await fetchJson<unknown[]>(`${BASE}/${endpoint}/${lang}`);
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error(`Réponse vide ou inattendue pour ${endpoint}/${lang}`);
      }
      await writeJson(path.join(RAW_DIR, "api", `${endpoint}.${lang}.json`), data);
      console.log(`${endpoint}/${lang} : ${data.length} entrées`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
