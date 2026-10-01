"use client";

import Link from "next/link";
import { useMemo } from "react";
import { GameEnd, GameStart } from "../ui/GameEnd";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import { DccFlow } from "./DccFlow";
import { DCC_MAX_POINTS, generate } from "./logic";

export default function DuoCarreCash({ data }: GameProps) {
  const game = useRun("duo-carre-cash");
  const { run, finished } = game;

  const questions = useMemo(() => (run ? generate(run.seed, run.difficulty, data) : []), [run, data]);

  if (!run || !questions.length) {
    return (
      <GameStart game={game}>
        <p className="text-mist">
          Dix questions. Avant chaque réponse, choisis ton risque : Duo (deux propositions, 1 point), Carré (quatre
          propositions, 3 points) ou Cash (aucune proposition, 5 points).
        </p>
        <p className="text-sm text-mist">
          Envie d&apos;autres questions ?{" "}
          <Link href="/quiz" className="font-semibold text-straw underline underline-offset-4">
            Les quiz de la communauté
          </Link>{" "}
          se jouent avec les mêmes règles.
        </p>
      </GameStart>
    );
  }
  if (finished) return <GameEnd game={game} data={data} max={questions.length * DCC_MAX_POINTS} />;

  return (
    <DccFlow
      key={run.seed}
      questions={questions}
      onFinish={(score, answers) => {
        game.finish(score);
        game.reward.submit({ slug: "duo-carre-cash", seed: run.seed, mode: data.mode, difficulty: run.difficulty, answers });
      }}
    />
  );
}
