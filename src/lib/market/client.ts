"use client";

/** Annonces du marché, lues auprès du serveur selon les filtres ; `reload` les relit après un achat ou une mise en vente. */
import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { SpoilerMode } from "@/lib/spoilers";
import type { MarketSort } from "./rules";
import type { MarketOverview } from "./types";

export type MarketQuery = { mode: SpoilerMode; lang: Locale; tier: number | null; query: string; sort: MarketSort; missingOnly: boolean };

export function useMarket(filters: MarketQuery, enabled: boolean): { market: MarketOverview | null; failed: boolean; reload: () => void } {
  const [loaded, setLoaded] = useState<MarketOverview | "failed" | null>(null);
  const [kick, setKick] = useState(0);
  const reload = useCallback(() => setKick((value) => value + 1), []);
  const { mode, lang, tier, query, sort, missingOnly } = filters;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const params = new URLSearchParams({ mode, lang, sort });
    if (tier !== null) params.set("tier", String(tier));
    if (query) params.set("q", query);
    if (missingOnly) params.set("missing", "1");
    fetch(`/api/market?${params}`, { cache: "no-store" })
      .then((response): Promise<MarketOverview | "failed"> => (response.ok ? response.json() : Promise.resolve("failed")))
      .catch((): "failed" => "failed")
      .then((value) => {
        if (!cancelled) setLoaded(value);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, kick, mode, lang, tier, query, sort, missingOnly]);

  return { market: enabled && loaded !== "failed" ? loaded : null, failed: enabled && loaded === "failed", reload };
}
