import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import { MARKET_SORTS, type MarketSort } from "@/lib/market/rules";
import { accountsEnabled } from "@/lib/server/db";
import { marketOverview } from "@/lib/server/market";
import { currentUser } from "@/lib/server/session";

/**
 * Annonces du marché. Paramètres : `mode` (ce que le joueur a le droit de
 * voir), `lang`, `tier` (rareté), `q` (nom), `sort` et `missing` (seulement
 * les avis qui manquent au joueur connecté).
 */
export async function GET(request: Request) {
  if (!accountsEnabled) return Response.json({ error: "unavailable" }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const user = await currentUser();
  const lang = params.get("lang");
  const tier = Number(params.get("tier"));
  const sort = params.get("sort");

  const overview = await marketOverview(user?.id ?? null, {
    // Sans précision, le mode anime : il ne révèle rien
    mode: params.get("mode") === "manga" ? "manga" : "anime",
    lang: isLocale(lang) ? lang : DEFAULT_LOCALE,
    tier: [1, 2, 3, 4].includes(tier) ? tier : null,
    query: (params.get("q") ?? "").slice(0, 60),
    sort: (MARKET_SORTS as readonly string[]).includes(sort ?? "") ? (sort as MarketSort) : "recent",
    missingOnly: params.get("missing") === "1",
  });
  return Response.json(overview, { headers: { "Cache-Control": "no-store" } });
}
