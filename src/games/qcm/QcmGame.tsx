"use client";

import { useMemo } from "react";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Portrait } from "../ui/Portrait";
import { QuizFlow, type QuizQuestion } from "../ui/QuizFlow";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import { generateQcm, usesDifficulty, type QcmSlug } from "./logic";

const INTROS: Record<QcmSlug, string> = {
  equipage: "Dix personnages. Pour chacun, retrouve son équipage ou son organisation parmi quatre propositions.",
  navires: "Dix navires. À toi de retrouver l'équipage qui navigue dessus.",
  "origine-et-race": "Dix questions sur la mer d'origine ou la race d'un personnage.",
  "dans-quel-arc": "Dix personnages. Dans quel arc chacun apparaît-il pour la première fois ?",
  "vrai-ou-faux": "Dix affirmations sur les personnages : à toi de trancher.",
  techniques: "Dix techniques. Retrouve à chaque fois le personnage qui l'utilise.",
  "armes-et-sabres": "Dix armes célèbres. Qui les manie ?",
  surnoms: "Dix surnoms. Retrouve à chaque fois le personnage qui le porte.",
  orthographe: "Dix personnages. Pour chacun, quatre graphies de son nom : une seule est la bonne.",
  "grand-ou-vieux": "Dix duels : qui est le plus grand, qui est le plus âgé ?",
  haki: "Dix personnages. Quels hakis chacun maîtrise-t-il ?",
  "mode-aleatoire": "Dix questions tirées au hasard dans tous les quiz.",
};

export default function QcmGame({ data, slug }: GameProps & { slug: QcmSlug }) {
  const game = useRun(slug);
  const { run, finished } = game;
  const withDifficulty = usesDifficulty(slug);

  const questions = useMemo<QuizQuestion[]>(() => {
    if (!run) return [];
    return generateQcm(slug, run.seed, run.difficulty, data).map((question) => ({
      id: question.id,
      prompt: (
        <div className="space-y-2 text-center">
          <p className="text-mist">{question.title}</p>
          {question.img && <Portrait img={question.img} />}
          <p className="font-display text-3xl tracking-wide text-straw">{question.subject}</p>
          {question.detail && <p className="text-mist">{question.detail}</p>}
        </div>
      ),
      options: question.options,
      answerId: question.answerId,
      explanation: question.explanation,
    }));
  }, [slug, run, data]);

  if (!run) {
    return (
      <GameStart game={game} withDifficulty={withDifficulty}>
        <p className="text-mist">{INTROS[slug]}</p>
      </GameStart>
    );
  }
  if (finished) return <GameEnd game={game} data={data} max={questions.length} withDifficulty={withDifficulty} />;

  return (
    <QuizFlow
      key={run.seed}
      questions={questions}
      onFinish={(score, answers) => {
        game.finish(score);
        game.reward.submit({ slug, seed: run.seed, mode: data.mode, difficulty: run.difficulty, answers });
      }}
    />
  );
}
