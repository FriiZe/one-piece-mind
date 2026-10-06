"use client";

import dynamic from "next/dynamic";
import { useState, type ComponentType } from "react";
import Link from "@/components/Link";
import { Modal } from "@/components/Modal";
import { formatNumber } from "@/games/engine/text";
import { GUEST_BERRY_CAP, guestAtCap } from "@/lib/economy";
import { usePlayer } from "@/lib/player/PlayerProvider";
import type { ClueSlug } from "../clues/logic";
import type { EstimateSlug } from "../estimate/logic";
import type { QcmSlug } from "../qcm/logic";
import type { LiveSlug } from "@/lib/games/catalog";
import { useLocale, useT } from "@/lib/i18n/client";
import { ModeBar, SpoilerGate } from "./SpoilerGate";
import { LoadingPanel, WithGameData } from "./WithGameData";
import type { GameProps } from "./types";

function LoadingGame() {
  const t = useT();
  return <LoadingPanel label={t("Chargement du jeu…", "Loading the game…")} />;
}

const load = (loader: () => Promise<{ default: ComponentType<GameProps> }>) => dynamic(loader, { loading: LoadingGame });

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
  connexions: load(() => import("../connexions/Game")),
  grille: load(() => import("../grille/Game")),
  "recrute-ton-equipage": load(() => import("../recrute-ton-equipage/Game")),
  "la-route-de-grand-line": load(() => import("../la-route-de-grand-line/Game")),
  "den-den-devin": load(() => import("../den-den-devin/Game")),
} satisfies Record<LiveSlug, ComponentType<GameProps>>;

/**
 * Un invité qui a atteint le plafond de Berrys le voit à chaque jeu qu'il ouvre : ses gains ne
 * s'accumulent plus tant qu'il n'a pas de compte.
 */
function GuestCapNotice() {
  const { status, state, accountsEnabled } = usePlayer();
  const t = useT();
  const locale = useLocale();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || status !== "guest" || !accountsEnabled || !guestAtCap(state)) return null;
  return (
    <Modal title={t("Tes Berrys t'attendent", "Your Berries are waiting")} onClose={() => setDismissed(true)}>
      <p className="text-foam">
        {t(
          `Tu as atteint les ${formatNumber(GUEST_BERRY_CAP, locale)} ฿ qu'on peut garder sans compte. Afin de collecter tes Berrys, merci de te connecter ou de créer un compte : tu les retrouveras dessus, et tes recrues avec.`,
          `You've reached the ${formatNumber(GUEST_BERRY_CAP, locale)} ฿ you can keep without an account. To collect your Berries, please log in or create an account: you'll find them there, and your recruits with them.`,
        )}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/profil" className="rounded-lg bg-straw px-4 py-2.5 font-bold text-ink hover:bg-straw-dark">
          {t("Se connecter ou créer un compte", "Log in or create an account")}
        </Link>
        <button type="button" onClick={() => setDismissed(true)} className="cursor-pointer px-2 py-2.5 font-bold text-mist underline-offset-4 hover:text-foam hover:underline">
          {t("Continuer sans compte", "Continue without an account")}
        </button>
      </div>
    </Modal>
  );
}

export function GameRunner({ slug }: { slug: LiveSlug }) {
  const t = useT();
  const Game = GAME_COMPONENTS[slug];
  return (
    <WithGameData loading={t("Chargement du jeu…", "Loading the game…")}>
      {({ raw, mode, setMode, data }) =>
        mode === null ? (
          <SpoilerGate data={raw} onChoose={setMode} />
        ) : (
          <div className="space-y-4">
            <GuestCapNotice />
            <ModeBar mode={mode} onChange={setMode} />
            {/* Changer de mode recommence la partie : les tirages ne sont plus les mêmes */}
            <Game key={mode} data={data} raw={raw} />
          </div>
        )
      }
    </WithGameData>
  );
}
