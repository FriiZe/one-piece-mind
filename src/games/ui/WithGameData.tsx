"use client";

import { Suspense, use, useMemo, type ReactNode } from "react";
import { resolveGameData, type GameData, type ResolvedData } from "../cards";
import { useLocale, useT } from "@/lib/i18n/client";
import type { SpoilerMode } from "@/lib/spoilers";
import { loadGameData } from "./data";
import { useIsClient, useStored } from "./storage";

export function LoadingPanel({ label }: { label?: string }) {
  const t = useT();
  return (
    <div role="status" className="rounded-2xl border border-sea-700 bg-sea-800/70 p-8 text-center text-mist">
      {label ?? t("Chargement…", "Loading…")}
    </div>
  );
}

type Loaded = {
  raw: GameData;
  /** Mode choisi par le joueur, `null` s'il n'a pas encore répondu. */
  mode: SpoilerMode | null;
  setMode: (mode: SpoilerMode | null) => void;
  /** Données dans le mode du joueur ; tant qu'il n'a pas choisi, le mode anime, qui ne révèle rien. */
  data: ResolvedData;
};

function Inner({ children }: { children: (loaded: Loaded) => ReactNode }) {
  const raw = use(loadGameData(useLocale()));
  const [mode, setMode] = useStored<SpoilerMode | null>("opm.mode", null);
  const data = useMemo(() => resolveGameData(raw, mode ?? "anime"), [raw, mode]);
  return children({ raw, mode, setMode, data });
}

/** Charge les données des jeux côté navigateur et les passe à ses enfants, filtrées selon le mode spoiler. */
export function WithGameData({ children, loading }: { children: (loaded: Loaded) => ReactNode; loading?: string }) {
  const isClient = useIsClient();
  if (!isClient) return <LoadingPanel label={loading} />;
  return (
    <Suspense fallback={<LoadingPanel label={loading} />}>
      <Inner>{children}</Inner>
    </Suspense>
  );
}
