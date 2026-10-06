"use client";

import { useRoundLimit } from "../ui/roomRound";
import { useMemo } from "react";
import { GameEnd, GameStart } from "../ui/GameEnd";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import Link from "@/components/Link";
import { useT } from "@/lib/i18n/client";
import { DccFlow } from "./DccFlow";
import { DCC_MAX_POINTS, generate } from "./logic";

export default function DuoCarreCash({ data }: GameProps) {
  const t = useT();
  const game = useRun("duo-carre-cash");
  const { run, finished } = game;

  const limit = useRoundLimit();
  const questions = useMemo(() => (run ? generate(run.seed, run.difficulty, data).slice(0, limit) : []), [run, data, limit]);

  if (!run || !questions.length) {
    return (
      <GameStart game={game}>
        <p className="text-mist">
          {t(
            "Dix questions. Avant chaque réponse, choisis ton risque : Duo (deux propositions, 1 point), Carré (quatre propositions, 3 points) ou Cash (aucune proposition, 5 points).",
            "Ten questions. Before each answer, pick your risk: Duo (two choices, 1 point), Quad (four choices, 3 points) or Cash (no choices, 5 points).",
          )}
        </p>
        <p className="text-sm text-mist">
          {t("Envie d'autres questions ?", "Want more questions?")}{" "}
          <Link href="/quiz" className="font-semibold text-straw underline underline-offset-4">
            {t("Les quiz de la communauté", "Community quizzes")}
          </Link>{" "}
          {t("se jouent avec les mêmes règles.", "are played with the same rules.")}
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
