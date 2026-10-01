"use client";

import type { ReactNode } from "react";
import type { ResolvedData } from "../cards";
import { RewardSummary } from "@/components/RewardSummary";
import { useT } from "@/lib/i18n/client";
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
  const t = useT();
  const { run, finished, best, reward } = game;
  if (!run || !finished) return null;
  return (
    <ResultPanel
      title={`${finished.score} / ${max}`}
      best={best !== null ? { label: withDifficulty ? t("Record à ce niveau", "Best at this level") : t("Record", "Best"), value: `${best} / ${max}` } : null}
      newBest={finished.newBest}
      actions={
        <>
          <Button onClick={() => game.start(run.difficulty)}>{t("Rejouer", "Play again")}</Button>
          {withDifficulty && (
            <Button variant="secondary" onClick={game.leave}>
              {t("Changer de difficulté", "Change difficulty")}
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
  const t = useT();
  return (
    <Panel className="space-y-4">
      {children}
      <Button onClick={() => game.start("normal")} className="min-h-14 w-full text-lg">
        {t("Jouer", "Play")}
      </Button>
    </Panel>
  );
}
