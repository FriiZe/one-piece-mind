"use client";

import { useMemo } from "react";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Portrait } from "../ui/Portrait";
import { QuizFlow, type QuizQuestion } from "../ui/QuizFlow";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import type { Localized } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/client";
import { generateQcm, usesDifficulty, type QcmSlug } from "./logic";

const INTROS: Record<QcmSlug, Localized> = {
  equipage: {
    fr: "Dix personnages. Pour chacun, retrouve son équipage ou son organisation parmi quatre propositions.",
    en: "Ten characters. For each one, pick their crew or organization out of four options.",
  },
  navires: {
    fr: "Dix navires. À toi de retrouver l'équipage qui navigue dessus.",
    en: "Ten ships. It's up to you to find the crew that sails each one.",
  },
  "origine-et-race": {
    fr: "Dix questions sur la mer d'origine ou la race d'un personnage.",
    en: "Ten questions about a character's home sea or race.",
  },
  "dans-quel-arc": {
    fr: "Dix personnages. Dans quel arc chacun apparaît-il pour la première fois ?",
    en: "Ten characters. In which arc does each one first appear?",
  },
  "vrai-ou-faux": {
    fr: "Dix affirmations sur les personnages : à toi de trancher.",
    en: "Ten statements about the characters: you make the call.",
  },
  techniques: {
    fr: "Dix techniques. Retrouve à chaque fois le personnage qui l'utilise.",
    en: "Ten techniques. Each time, find the character who uses it.",
  },
  "armes-et-sabres": { fr: "Dix armes célèbres. Qui les manie ?", en: "Ten famous weapons. Who wields them?" },
  surnoms: {
    fr: "Dix surnoms. Retrouve à chaque fois le personnage qui le porte.",
    en: "Ten epithets. Each time, find the character who goes by it.",
  },
  orthographe: {
    fr: "Dix personnages. Pour chacun, quatre graphies de son nom : une seule est la bonne.",
    en: "Ten characters. For each one, four spellings of their name: only one is right.",
  },
  "grand-ou-vieux": {
    fr: "Dix duels : qui est le plus grand, qui est le plus âgé ?",
    en: "Ten face-offs: who is taller, who is older?",
  },
  haki: {
    fr: "Dix personnages. Quels hakis chacun maîtrise-t-il ?",
    en: "Ten characters. Which types of Haki has each one mastered?",
  },
  "mode-aleatoire": {
    fr: "Dix questions tirées au hasard dans tous les quiz.",
    en: "Ten questions drawn at random from every quiz.",
  },
};

export default function QcmGame({ data, slug }: GameProps & { slug: QcmSlug }) {
  const locale = useLocale();
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
        <p className="text-mist">{INTROS[slug][locale]}</p>
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
