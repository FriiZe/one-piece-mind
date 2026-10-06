"use client";

import { useEffect, useState } from "react";
import type { Difficulty } from "@/games/engine/difficulty";
import type { DailyLeaderboard, GameLeaderboard, GlobalLeaderboard, Period } from "./types";

/**
 * Classement d'un jeu sur une période, pour un niveau ou pour tous ; `null` pendant le chargement,
 * `"failed"` si le serveur n'a pas répondu.
 */
export function useGameLeaderboard(slug: string, period: Period, difficulty: Difficulty | null): GameLeaderboard | "failed" | null {
  const [loaded, setLoaded] = useState<{ key: string; board: GameLeaderboard | "failed" } | null>(null);
  const key = `${slug}:${period}:${difficulty ?? "all"}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leaderboard?slug=${encodeURIComponent(slug)}&period=${period}${difficulty ? `&difficulty=${difficulty}` : ""}`, { cache: "no-store" })
      .then((response): Promise<GameLeaderboard | "failed"> => (response.ok ? response.json() : Promise.resolve("failed")))
      .catch((): "failed" => "failed")
      .then((board) => {
        if (!cancelled) setLoaded({ key, board });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, period, difficulty, key]);

  return loaded?.key === key ? loaded.board : null;
}

export function useGlobalLeaderboard(): GlobalLeaderboard | "failed" | null {
  const [board, setBoard] = useState<GlobalLeaderboard | "failed" | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard", { cache: "no-store" })
      .then((response): Promise<GlobalLeaderboard | "failed"> => (response.ok ? response.json() : Promise.resolve("failed")))
      .catch((): "failed" => "failed")
      .then((loaded) => {
        if (!cancelled) setBoard(loaded);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return board;
}

/** Défi du jour d'OnePiecedle ; relu à chaque changement de `refresh` (une partie vient d'être payée). */
export function useDailyLeaderboard(refresh: number): DailyLeaderboard | "failed" | null {
  const [board, setBoard] = useState<DailyLeaderboard | "failed" | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard?slug=onepiecedle-daily", { cache: "no-store" })
      .then((response): Promise<DailyLeaderboard | "failed"> => (response.ok ? response.json() : Promise.resolve("failed")))
      .catch((): "failed" => "failed")
      .then((loaded) => {
        if (!cancelled) setBoard(loaded);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);
  return board;
}
