"use client";

/** Classé du joueur connecté, lu auprès du serveur ; `reload` le relit après un duel. */
import { useCallback, useEffect, useState } from "react";
import type { RankedOverview } from "./types";

export function useRankedOverview(enabled: boolean): { overview: RankedOverview | null; failed: boolean; reload: () => void } {
  const [loaded, setLoaded] = useState<RankedOverview | "failed" | null>(null);
  const [kick, setKick] = useState(0);
  const reload = useCallback(() => setKick((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/ranked", { cache: "no-store" })
      .then((response): Promise<RankedOverview | "failed"> => (response.ok ? response.json() : Promise.resolve("failed")))
      .catch((): "failed" => "failed")
      .then((value) => {
        if (!cancelled) setLoaded(value);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, kick]);

  const overview = enabled && loaded !== "failed" ? loaded : null;
  return { overview, failed: enabled && loaded === "failed", reload };
}
