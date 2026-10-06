"use client";

import { useState } from "react";
import type { Difficulty } from "../engine/difficulty";
import { useGameReward } from "@/lib/player/useGameReward";
import { useNewSeed } from "./roomRound";
import { useBest } from "./storage";

export type RunBase = { seed: number; difficulty: Difficulty };
export type Finished = { score: number; newBest: boolean };

/**
 * Cycle commun à la plupart des jeux : lancer une partie (graine + difficulté),
 * la terminer (record, récompense), rejouer.
 */
export function useRun(slug: string) {
  const [run, setRun] = useState<RunBase | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [best, submitBest] = useBest(`${slug}.${run?.difficulty ?? "normal"}`);
  const reward = useGameReward();
  const newSeed = useNewSeed();

  function start(difficulty: Difficulty) {
    reward.reset();
    setFinished(null);
    setRun({ seed: newSeed(), difficulty });
  }
  function finish(score: number) {
    setFinished({ score, newBest: submitBest(score) });
  }
  function leave() {
    setRun(null);
    setFinished(null);
  }

  return { run, finished, best, reward, start, finish, leave };
}
