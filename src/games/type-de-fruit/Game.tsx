"use client";

import { useMemo, useState } from "react";
import { createRng, randomSeed } from "../engine/rng";
import { Button, Panel, ResultPanel } from "../ui/primitives";
import { QuizFlow, type QuizQuestion } from "../ui/QuizFlow";
import { useBest } from "../ui/storage";
import type { GameProps } from "../ui/types";
import { FRUIT_TYPE_LABELS } from "@/lib/data/labels";
import { FAMILIES, familyOf, generateQuiz } from "./logic";

const FAMILY_LABELS = { paramecia: "Paramecia", logia: "Logia", zoan: "Zoan" } as const;
const LENGTH = 10;

export default function TypeDeFruit({ data }: GameProps) {
  const [seed, setSeed] = useState<number | null>(null);
  const [result, setResult] = useState<{ score: number; newBest: boolean } | null>(null);
  const [best, submitBest] = useBest("type-de-fruit");

  const questions = useMemo<QuizQuestion[]>(() => {
    if (seed === null) return [];
    return generateQuiz(createRng(seed), data.fruits, LENGTH).map((fruit) => ({
      id: fruit.id,
      prompt: (
        <div className="text-center">
          <p className="font-display text-3xl tracking-wide text-straw">{fruit.name}</p>
          {fruit.romaji && <p className="text-mist">{fruit.romaji}</p>}
        </div>
      ),
      options: FAMILIES.map((family) => ({ id: family, label: FAMILY_LABELS[family] })),
      answerId: familyOf(fruit.type)!,
      explanation: `C'est un fruit de type ${FRUIT_TYPE_LABELS[fruit.type]}.`,
    }));
  }, [seed, data.fruits]);

  function start() {
    setResult(null);
    setSeed(randomSeed());
  }

  if (seed === null) {
    return (
      <Panel className="space-y-4">
        <p className="text-mist">Dix fruits du démon. Pour chacun, une seule question : Paramecia, Logia ou Zoan ?</p>
        <Button onClick={start}>Jouer</Button>
      </Panel>
    );
  }

  if (result) {
    return (
      <ResultPanel
        title={`${result.score} / ${LENGTH}`}
        best={best !== null ? { label: "Record", value: `${best} / ${LENGTH}` } : null}
        newBest={result.newBest}
        actions={<Button onClick={start}>Rejouer</Button>}
      >
        <p>{result.score === LENGTH ? "Sans faute : rien ne t'échappe." : "Les Zoan et les Logia sont plus rares qu'on ne croit."}</p>
      </ResultPanel>
    );
  }

  return (
    <QuizFlow
      key={seed}
      questions={questions}
      columns={3}
      onFinish={(score) => setResult({ score, newBest: submitBest(score) })}
    />
  );
}
