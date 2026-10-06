"use client";

import { AutoStart, useNewSeed, useRoomRound, useRoundLimit } from "../ui/roomRound";
import { useMemo, useState } from "react";
import { createRng } from "../engine/rng";
import { Button, Panel, ResultPanel } from "../ui/primitives";
import { QuizFlow, type QuizQuestion } from "../ui/QuizFlow";
import { useBest } from "../ui/storage";
import { RewardSummary } from "@/components/RewardSummary";
import { useLocale, useT } from "@/lib/i18n/client";
import { useGameReward } from "@/lib/player/useGameReward";
import type { GameProps } from "../ui/types";
import { FRUIT_TYPE_LABELS } from "@/lib/data/labels";
import { FAMILIES, familyOf, generateQuiz } from "./logic";

const FAMILY_LABELS = { paramecia: "Paramecia", logia: "Logia", zoan: "Zoan" } as const;

export default function TypeDeFruit({ data }: GameProps) {
  const t = useT();
  const locale = useLocale();
  const [seed, setSeed] = useState<number | null>(null);
  const [result, setResult] = useState<{ score: number; newBest: boolean } | null>(null);
  const [best, submitBest] = useBest("type-de-fruit");
  const reward = useGameReward();
  const newSeed = useNewSeed();
  const inRoom = useRoomRound() !== null;
  const limit = useRoundLimit();

  const questions = useMemo<QuizQuestion[]>(() => {
    if (seed === null) return [];
    return generateQuiz(createRng(seed), data.fruits).slice(0, limit).map((fruit) => ({
      id: fruit.id,
      prompt: (
        <div className="text-center">
          <p className="font-display text-3xl tracking-wide text-straw">{fruit.name}</p>
          {fruit.romaji && <p className="text-mist">{fruit.romaji}</p>}
        </div>
      ),
      options: FAMILIES.map((family) => ({ id: family, label: FAMILY_LABELS[family] })),
      answerId: familyOf(fruit.type)!,
      explanation: t(
        `C'est un fruit de type ${FRUIT_TYPE_LABELS[locale][fruit.type]}.`,
        `This fruit's type is ${FRUIT_TYPE_LABELS[locale][fruit.type]}.`,
      ),
    }));
  }, [seed, data.fruits, t, locale, limit]);

  function start() {
    reward.reset();
    setResult(null);
    setSeed(newSeed());
  }

  if (seed === null && inRoom) return <AutoStart onStart={start} />;
  if (seed === null) {
    return (
      <Panel className="space-y-4">
        <p className="text-mist">
          {t(
            "Dix fruits du démon. Pour chacun, une seule question : Paramecia, Logia ou Zoan ?",
            "Ten Devil Fruits. For each one, a single question: Paramecia, Logia or Zoan?",
          )}
        </p>
        <Button onClick={start}>{t("Jouer", "Play")}</Button>
      </Panel>
    );
  }

  if (result) {
    return (
      <ResultPanel
        title={`${result.score} / ${questions.length}`}
        best={best !== null ? { label: t("Record", "Best"), value: `${best} / ${questions.length}` } : null}
        newBest={result.newBest}
        actions={<Button onClick={start}>{t("Rejouer", "Play again")}</Button>}
      >
        <p>
          {result.score === questions.length
            ? t("Sans faute : rien ne t'échappe.", "A perfect score: nothing gets past you.")
            : t("Les Zoan et les Logia sont plus rares qu'on ne croit.", "Zoans and Logias are rarer than you'd think.")}
        </p>
        <RewardSummary view={reward.view} data={data} />
      </ResultPanel>
    );
  }

  return (
    <QuizFlow
      key={seed}
      questions={questions}
      columns={3}
      onFinish={(score, answers) => {
        setResult({ score, newBest: submitBest(score) });
        reward.submit({ slug: "type-de-fruit", seed, mode: data.mode, answers });
      }}
    />
  );
}
