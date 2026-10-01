"use client";

import dynamic from "next/dynamic";
import { Suspense, use, useMemo, type ComponentType } from "react";
import { resolveGameData, type GameData } from "../cards";
import type { LiveSlug } from "@/lib/games/catalog";
import type { SpoilerMode } from "@/lib/spoilers";
import { ModeBar, SpoilerGate } from "./SpoilerGate";
import { useIsClient, useStored } from "./storage";
import type { GameProps } from "./types";

function Loading() {
  return (
    <div role="status" className="rounded-2xl border border-sea-700 bg-sea-800/70 p-8 text-center text-mist">
      Chargement du jeu…
    </div>
  );
}

const load = (loader: () => Promise<{ default: ComponentType<GameProps> }>) => dynamic(loader, { loading: Loading });

const GAME_COMPONENTS = {
  onepiecedle: load(() => import("../onepiecedle/Game")),
  revelation: load(() => import("../revelation/Game")),
  "zoom-extreme": load(() => import("../zoom-extreme/Game")),
  "plus-ou-moins": load(() => import("../plus-ou-moins/Game")),
  "le-classement": load(() => import("../le-classement/Game")),
  "type-de-fruit": load(() => import("../type-de-fruit/Game")),
  "qui-a-mange-ce-fruit": load(() => import("../qui-a-mange-ce-fruit/Game")),
  "trouve-les-tous": load(() => import("../trouve-les-tous/Game")),
  "avis-de-recherche": load(() => import("../avis-de-recherche/Game")),
} satisfies Record<LiveSlug, ComponentType<GameProps>>;

let pending: Promise<GameData> | undefined;

/** Les données sont communes à tous les jeux : un seul téléchargement par visite. */
function loadGameData(): Promise<GameData> {
  pending ??= fetch("/data/jeux.json").then((response) => {
    if (!response.ok) {
      pending = undefined;
      throw new Error(`Données des jeux indisponibles (${response.status})`);
    }
    return response.json() as Promise<GameData>;
  });
  return pending;
}

function Loaded({ slug }: { slug: LiveSlug }) {
  const raw = use(loadGameData());
  const [mode, setMode] = useStored<SpoilerMode | null>("opm.mode", null);
  const data = useMemo(() => (mode ? resolveGameData(raw, mode) : null), [raw, mode]);

  if (!mode || !data) return <SpoilerGate data={raw} onChoose={setMode} />;

  const Game = GAME_COMPONENTS[slug];
  return (
    <div className="space-y-4">
      <ModeBar mode={mode} onChange={setMode} />
      {/* Changer de mode recommence la partie : les tirages ne sont plus les mêmes */}
      <Game key={mode} data={data} raw={raw} />
    </div>
  );
}

export function GameRunner({ slug }: { slug: LiveSlug }) {
  const isClient = useIsClient();
  if (!isClient) return <Loading />;
  return (
    <Suspense fallback={<Loading />}>
      <Loaded slug={slug} />
    </Suspense>
  );
}
