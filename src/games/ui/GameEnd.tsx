"use client";

import type { ReactNode } from "react";
import type { ResolvedData } from "../cards";
import { RewardSummary } from "@/components/RewardSummary";
import { Button, Panel, ResultPanel } from "./primitives";
import { StartScreen } from "./StartScreen";
import type { useRun } from "./useRun";

/** Écran de fin commun : score, record, récompense, rejouer. */
export function GameEnd({
  game,
  data,
  max,
  withDifficulty = true,
  children,
}: {
  game: ReturnType<typeof useRun>;
  data: ResolvedData;
  max: number;
  withDifficulty?: boolean;
  children?: ReactNode;
}) {
  const { run, finished, best, reward } = game;
  if (!run || !finished) return null;
  return (
    <ResultPanel
      title={`${finished.score} / ${max}`}
      best={best !== null ? { label: withDifficulty ? "Record à ce niveau" : "Record", value: `${best} / ${max}` } : null}
      newBest={finished.newBest}
      actions={
        <>
          <Button onClick={() => game.start(run.difficulty)}>Rejouer</Button>
          {withDifficulty && (
            <Button variant="secondary" onClick={game.leave}>
              Changer de difficulté
            </Button>
          )}
        </>
      }
    >
      {children}
      <RewardSummary view={reward.view} data={data} />
    </ResultPanel>
  );
}

/** Écran de départ : avec choix de la difficulté, ou un simple bouton quand elle n'a pas de sens. */
export function GameStart({
  game,
  withDifficulty = true,
  children,
}: {
  game: ReturnType<typeof useRun>;
  withDifficulty?: boolean;
  children: ReactNode;
}) {
  return withDifficulty ? <StartScreen onStart={game.start}>{children}</StartScreen> : <PlainStart game={game}>{children}</PlainStart>;
}

function PlainStart({ game, children }: { game: ReturnType<typeof useRun>; children: ReactNode }) {
  return (
    <Panel className="space-y-4">
      {children}
      <Button onClick={() => game.start("normal")} className="min-h-14 w-full text-lg">
        Jouer
      </Button>
    </Panel>
  );
}
