"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import type { Difficulty } from "../engine/difficulty";
import { randomSeed } from "../engine/rng";
import type { GameReport } from "../report";
import { useT } from "@/lib/i18n/client";

/**
 * Manche d'un salon multijoueur jouée dans un jeu complet : le salon impose la
 * graine et la difficulté, et reçoit le compte rendu à la place de la
 * récompense solo. Hors salon, il n'y a pas de manche.
 */
export type RoomRound = { seed: number; difficulty: Difficulty; submit: (report: GameReport) => void };

const RoomRoundContext = createContext<RoomRound | null>(null);

export function RoomRoundProvider({ round, children }: { round: RoomRound; children: ReactNode }) {
  return <RoomRoundContext.Provider value={round}>{children}</RoomRoundContext.Provider>;
}

export const useRoomRound = () => useContext(RoomRoundContext);

/** Graine d'une nouvelle partie : celle de la manche en salon, une au hasard sinon. */
export function useNewSeed(): () => number {
  const round = useRoomRound();
  return () => round?.seed ?? randomSeed();
}

/**
 * En salon, l'écran de départ n'a pas lieu d'être : la difficulté est celle du
 * salon, et la partie démarre aussitôt.
 */
export function AutoStart({ onStart }: { onStart: (difficulty: Difficulty) => void }) {
  const t = useT();
  const round = useRoomRound();
  const started = useRef(false);
  useEffect(() => {
    if (!round || started.current) return;
    started.current = true;
    onStart(round.difficulty);
  }, [round, onStart]);
  return (
    <div role="status" className="rounded-2xl border border-sea-700 bg-sea-800/70 p-4 text-center text-mist sm:p-6">
      {t("Préparation de la manche…", "Getting the round ready…")}
    </div>
  );
}

/**
 * Nombre d'unités jouées dans la partie : en salon, une manche n'est qu'une
 * grille, un classement, une affiche… ; hors salon, `undefined` (la partie entière).
 */
export function useRoundLimit(): number | undefined {
  return useRoomRound() ? 1 : undefined;
}
