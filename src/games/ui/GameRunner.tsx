"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ClueSlug } from "../clues/logic";
import type { EstimateSlug } from "../estimate/logic";
import type { QcmSlug } from "../qcm/logic";
import type { LiveSlug } from "@/lib/games/catalog";
import { ModeBar, SpoilerGate } from "./SpoilerGate";
import { LoadingPanel, WithGameData } from "./WithGameData";
import type { GameProps } from "./types";

const load = (loader: () => Promise<{ default: ComponentType<GameProps> }>) =>
  dynamic(loader, { loading: () => <LoadingPanel label="Chargement du jeu…" /> });

// Les jeux d'une même famille partagent un composant, paramétré par leur identifiant
function qcm(slug: QcmSlug) {
  return load(async () => {
    const { default: QcmGame } = await import("../qcm/QcmGame");
    return { default: (props: GameProps) => <QcmGame {...props} slug={slug} /> };
  });
}
function estimate(slug: EstimateSlug) {
  return load(async () => {
    const { default: EstimateGame } = await import("../estimate/EstimateGame");
    return { default: (props: GameProps) => <EstimateGame {...props} slug={slug} /> };
  });
}
function clue(slug: ClueSlug) {
  return load(async () => {
    const { default: ClueGame } = await import("../clues/ClueGame");
    return { default: (props: GameProps) => <ClueGame {...props} slug={slug} /> };
  });
}

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
  memo: load(() => import("../memo/Game")),
  wordle: load(() => import("../wordle/Game")),
  anagramme: load(() => import("../anagramme/Game")),
  chronologie: load(() => import("../chronologie/Game")),
  "les-indices": clue("les-indices"),
  emojis: clue("emojis"),
  "devine-la-prime": estimate("devine-la-prime"),
  "premiere-apparition": estimate("premiere-apparition"),
  "prime-d-equipage": estimate("prime-d-equipage"),
  surnoms: qcm("surnoms"),
  orthographe: qcm("orthographe"),
  "grand-ou-vieux": qcm("grand-ou-vieux"),
  equipage: qcm("equipage"),
  haki: qcm("haki"),
  techniques: qcm("techniques"),
  "armes-et-sabres": qcm("armes-et-sabres"),
  navires: qcm("navires"),
  "origine-et-race": qcm("origine-et-race"),
  "dans-quel-arc": qcm("dans-quel-arc"),
  "vrai-ou-faux": qcm("vrai-ou-faux"),
  "mode-aleatoire": qcm("mode-aleatoire"),
  "duo-carre-cash": load(() => import("../duo-carre-cash/Game")),
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
