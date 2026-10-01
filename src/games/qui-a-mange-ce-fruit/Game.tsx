"use client";

import { useMemo, useState } from "react";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, randomSeed } from "../engine/rng";
import { Button, ResultPanel } from "../ui/primitives";
import { QuizFlow, type QuizQuestion } from "../ui/QuizFlow";
import { StartScreen } from "../ui/StartScreen";
import { useBest } from "../ui/storage";
import type { GameProps } from "../ui/types";
import { answerLabel, generateQuiz } from "./logic";

type Run = { seed: number; difficulty: Difficulty };

export default function QuiAMangeCeFruit({ data }: GameProps) {
  const [run, setRun] = useState<Run | null>(null);
  const [result, setResult] = useState<{ score: number; newBest: boolean } | null>(null);
  const [best, submitBest] = useBest(`qui-a-mange-ce-fruit.${run?.difficulty ?? "normal"}`);

  const questions = useMemo<QuizQuestion[]>(() => {
    if (!run) return [];
    const quiz = generateQuiz(createRng(run.seed), data, byDifficulty(data.characters, run.difficulty));
    return quiz.map((q, index): QuizQuestion => {
      const explanation = `La réponse était : ${answerLabel(q)}.`;
      if (q.kind === "fruit-to-user") {
        return {
          id: `${index}-${q.fruit.id}`,
          prompt: (
            <div className="text-center">
              <p className="text-mist">Qui a mangé ce fruit ?</p>
              <p className="font-display text-3xl tracking-wide text-straw">{q.fruit.name}</p>
              {q.fruit.romaji && <p className="text-mist">{q.fruit.romaji}</p>}
            </div>
          ),
          options: q.options.map((c) => ({ id: c.id, label: c.name, detail: c.altName ?? undefined })),
          answerId: q.answerId,
          explanation,
        };
      }
      return {
        id: `${index}-${q.character.id}`,
        prompt: (
          <div className="text-center">
            <p className="text-mist">Quel fruit a-t-il mangé ?</p>
            <p className="font-display text-3xl tracking-wide text-straw">{q.character.name}</p>
            {q.character.altName && <p className="text-mist">{q.character.altName}</p>}
          </div>
        ),
        options: q.options.map((f) => ({ id: f.id, label: f.name, detail: f.romaji ?? undefined })),
        answerId: q.answerId,
        explanation,
      };
    });
  }, [run, data]);

  if (!run) {
    return (
      <StartScreen
        onStart={(difficulty) => {
          setResult(null);
          setRun({ seed: randomSeed(), difficulty });
        }}
      >
        <p className="text-mist">
          Dix questions, dans les deux sens : retrouver l&apos;utilisateur d&apos;un fruit, ou le fruit d&apos;un personnage.
        </p>
      </StartScreen>
    );
  }

  if (result) {
    return (
      <ResultPanel
        title={`${result.score} / ${questions.length}`}
        best={best !== null ? { label: "Record à ce niveau", value: `${best} / ${questions.length}` } : null}
        newBest={result.newBest}
        actions={
          <>
            <Button
              onClick={() => {
                setResult(null);
                setRun({ seed: randomSeed(), difficulty: run.difficulty });
              }}
            >
              Rejouer
            </Button>
            <Button variant="secondary" onClick={() => setRun(null)}>
              Changer de difficulté
            </Button>
          </>
        }
      />
    );
  }

  return (
    <QuizFlow key={run.seed} questions={questions} onFinish={(score) => setResult({ score, newBest: submitBest(score) })} />
  );
}
