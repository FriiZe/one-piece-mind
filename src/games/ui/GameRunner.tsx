"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { LiveSlug } from "@/lib/games/catalog";
import { ModeBar, SpoilerGate } from "./SpoilerGate";
import { LoadingPanel, WithGameData } from "./WithGameData";
import type { GameProps } from "./types";

const load = (loader: () => Promise<{ default: ComponentType<GameProps> }>) =>
  dynamic(loader, { loading: () => <LoadingPanel label="Chargement du jeu…" /> });

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

export function GameRunner({ slug }: { slug: LiveSlug }) {
  const Game = GAME_COMPONENTS[slug];
  return (
    <WithGameData loading="Chargement du jeu…">
      {({ raw, mode, setMode, data }) =>
        mode === null ? (
          <SpoilerGate data={raw} onChoose={setMode} />
        ) : (
          <div className="space-y-4">
            <ModeBar mode={mode} onChange={setMode} />
            {/* Changer de mode recommence la partie : les tirages ne sont plus les mêmes */}
            <Game key={mode} data={data} raw={raw} />
          </div>
        )
      }
    </WithGameData>
  );
}
