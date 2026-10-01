"use client";

/** Raid de la semaine, lu auprès du serveur et rafraîchi de temps en temps ; `reload` le relit après un assaut. */
import { useCallback, useEffect, useState } from "react";
import type { RaidView } from "./types";

const REFRESH_MS = 60_000;

export function useRaid(enabled: boolean): { raid: RaidView | null; failed: boolean; reload: () => void } {
  const [loaded, setLoaded] = useState<RaidView | "failed" | null>(null);
  const [kick, setKick] = useState(0);
  const reload = useCallback(() => setKick((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () =>
      fetch("/api/raid", { cache: "no-store" })
        .then((response): Promise<RaidView | "failed"> => (response.ok ? response.json() : Promise.resolve("failed")))
        .catch((): "failed" => "failed")
        .then((value) => {
          // Une relecture manquée ne remplace pas ce qui est déjà affiché
          if (!cancelled) setLoaded((current) => (value === "failed" && current && current !== "failed" ? current : value));
        });
    load();
    // Les autres joueurs attaquent en même temps : la jauge suit, sans insister quand l'onglet est en arrière-plan
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, kick]);

  return { raid: enabled && loaded !== "failed" ? loaded : null, failed: enabled && loaded === "failed", reload };
}
