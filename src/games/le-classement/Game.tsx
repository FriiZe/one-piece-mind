"use client";

import { useNewSeed, useRoundLimit } from "../ui/roomRound";
import { useMemo, useState } from "react";
import type { PlayCharacter } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { formatBounty, formatHeight } from "../engine/text";
import { Button, Panel, Progress, ResultPanel } from "../ui/primitives";
import { SortableList, type SortableItem } from "../ui/SortableList";
import { StartScreen } from "../ui/StartScreen";
import { useBest } from "../ui/storage";
import type { GameProps } from "../ui/types";
import { RewardSummary } from "@/components/RewardSummary";
import type { Locale } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { useGameReward } from "@/lib/player/useGameReward";
import { CRITERIA, correctOrder, roundAt, ROUND_SIZE, ROUNDS, type Criterion } from "./logic";

function formatValue(character: PlayCharacter, criterion: Criterion, locale: Locale): string {
  if (criterion === "bounty") return formatBounty(character.bounty, locale);
  if (criterion === "height") return formatHeight(character.height, locale);
  return locale === "en" ? `${character.age} years old` : `${character.age} ans`;
}

type Run = {
  seed: number;
  difficulty: Difficulty;
  round: number;
  /** Ordre proposé par le joueur pour la manche en cours ; `null` tant qu'il n'a rien déplacé. */
  order: string[] | null;
  submitted: boolean;
  /** Classements validés aux manches précédentes, pour le compte rendu de partie. */
  orders: string[][];
  score: number;
  finished: boolean;
  newBest: boolean;
};

export default function LeClassement({ data }: GameProps) {
  const t = useT();
  const locale = useLocale();
  const [run, setRun] = useState<Run | null>(null);
  const [best, submitBest] = useBest(`le-classement.${run?.difficulty ?? "normal"}`);
  const reward = useGameReward();
  const newSeed = useNewSeed();
  const rounds = useRoundLimit() ?? ROUNDS;
  const maxScore = rounds * ROUND_SIZE;

  const seed = run?.seed;
  const roundIndex = run?.round;
  const difficulty = run?.difficulty;
  const round = useMemo(
    () =>
      seed === undefined || roundIndex === undefined || difficulty === undefined
        ? null
        : roundAt(seed, roundIndex, byDifficulty(data.characters, difficulty)),
    [data.characters, seed, roundIndex, difficulty],
  );

  function start(level: Difficulty) {
    reward.reset();
    setRun({
      seed: newSeed(),
      difficulty: level,
      round: 0,
      order: null,
      submitted: false,
      orders: [],
      score: 0,
      finished: false,
      newBest: false,
    });
  }

  if (!run || !round) {
    return (
      <StartScreen onStart={start}>
        <p className="text-mist">
          {t(
            "Cinq manches. À chaque fois, cinq personnages à ranger selon leur prime, leur taille ou leur âge, en les faisant glisser. Un point par personnage au bon rang.",
            "Five rounds. Each time, five characters to rank by bounty, height or age, by dragging them into place. One point for each character in the right spot.",
          )}
        </p>
      </StartScreen>
    );
  }

  if (run.finished) {
    return (
      <ResultPanel
        title={`${run.score} / ${maxScore}`}
        best={best !== null ? { label: t("Record à ce niveau", "Best at this level"), value: `${best} / ${maxScore}` } : null}
        newBest={run.newBest}
        actions={
          <>
            <Button onClick={() => start(run.difficulty)}>{t("Rejouer", "Play again")}</Button>
            <Button variant="secondary" onClick={() => setRun(null)}>
              {t("Changer de difficulté", "Change difficulty")}
            </Button>
          </>
        }
      >
        <RewardSummary view={reward.view} data={data} />
      </ResultPanel>
    );
  }

  const items = new Map<string, SortableItem>(
    round.items.map((c) => [c.id, { id: c.id, label: c.name, detail: formatValue(c, round.criterion, locale), img: c.img }]),
  );
  const order = run.order ?? round.items.map((c) => c.id);
  const expected = correctOrder(round);
  const criterion = CRITERIA[round.criterion];

  function submit() {
    if (!run) return;
    const points = order.filter((id, index) => expected[index] === id).length;
    setRun({ ...run, order, submitted: true, orders: [...run.orders, order], score: run.score + points });
  }

  function next() {
    if (!run) return;
    if (run.round === rounds - 1) {
      setRun({ ...run, finished: true, newBest: submitBest(run.score) });
      reward.submit({ slug: "le-classement", seed: run.seed, mode: data.mode, difficulty: run.difficulty, orders: run.orders });
      return;
    }
    setRun({ ...run, round: run.round + 1, order: null, submitted: false });
  }

  return (
    <Panel className="space-y-4">
      <Progress current={run.round + 1} total={rounds} score={t(`Score : ${run.score}`, `Score: ${run.score}`)} />
      <p className="text-lg text-foam">
        {t("Range ces personnages par", "Rank these characters by")}{" "}
        <strong className="text-straw">{criterion.label[locale]}</strong>, {criterion.order[locale]}.
      </p>
      <SortableList
        order={order}
        items={items}
        expected={expected}
        submitted={run.submitted}
        onReorder={(next) => setRun({ ...run, order: next })}
      />
      {run.submitted ? (
        <Button autoFocus onClick={next}>
          {run.round === rounds - 1 ? t("Voir mon score", "See my score") : t("Manche suivante", "Next round")}
        </Button>
      ) : (
        <Button onClick={submit}>{t("Valider", "Submit")}</Button>
      )}
    </Panel>
  );
}
