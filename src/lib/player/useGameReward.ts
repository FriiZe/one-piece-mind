"use client";

import { useCallback, useState } from "react";
import type { GameReport } from "@/games/report";
import { usePlayer } from "./PlayerProvider";
import type { GameResult } from "./types";

export type RewardView = { status: "pending" } | { status: "done"; result: GameResult };

/**
 * Envoi du compte rendu en fin de partie et suivi de la récompense.
 * `submit` s'appelle dans le gestionnaire qui termine la partie, `reset` au lancement de la suivante.
 */
export function useGameReward() {
  const { reportGame } = usePlayer();
  const [view, setView] = useState<RewardView | null>(null);

  const submit = useCallback(
    (report: GameReport) => {
      setView({ status: "pending" });
      reportGame(report).then(
        (result) => setView({ status: "done", result }),
        () => setView({ status: "done", result: { ok: false, reason: "unavailable" } }),
      );
    },
    [reportGame],
  );
  const reset = useCallback(() => setView(null), []);

  return { view, submit, reset };
}
