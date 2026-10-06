"use client";

import { useRoundLimit } from "../ui/roomRound";
import { useMemo, useState } from "react";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Button, Panel, Progress } from "../ui/primitives";
import { SortableList } from "../ui/SortableList";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import { useT } from "@/lib/i18n/client";
import { correctOrder, roundAt, ROUND_SIZE, ROUNDS, scoreRound } from "./logic";

type Progression = {
  round: number;
  /** Ordre proposé pour la manche en cours ; `null` tant que le joueur n'a rien déplacé. */
  order: string[] | null;
  submitted: boolean;
  orders: string[][];
  score: number;
};
const START: Progression = { round: 0, order: null, submitted: false, orders: [], score: 0 };

export default function Chronologie({ data }: GameProps) {
  const t = useT();
  const base = useRun("chronologie");
  const rounds = useRoundLimit() ?? ROUNDS;
  const [state, setState] = useState<Progression>(START);
  const game = {
    ...base,
    start: (difficulty: Parameters<typeof base.start>[0]) => {
      setState(START);
      base.start(difficulty);
    },
  };
  const { run, finished } = base;

  const round = useMemo(
    () => (run ? roundAt(run.seed, state.round, run.difficulty, data) : null),
    [run, state.round, data],
  );

  if (!run || !round) {
    return (
      <GameStart game={game}>
        <p className="text-mist">
          {t(
            "Cinq manches. À chaque fois, cinq arcs ou cinq personnages à remettre dans l'ordre de l'histoire, en les faisant glisser. Un point par élément au bon rang.",
            "Five rounds. Each time, drag five arcs or five characters back into story order. One point for each item in the right spot.",
          )}
        </p>
      </GameStart>
    );
  }
  if (finished) return <GameEnd game={game} data={data} max={rounds * ROUND_SIZE} />;

  const byId = new Map(round.items.map((item) => [item.id, item]));
  const order = state.order ?? round.items.map((item) => item.id);
  const expected = correctOrder(round);
  const last = state.round === rounds - 1;

  function submit() {
    if (!round) return;
    setState({ ...state, order, submitted: true, orders: [...state.orders, order], score: state.score + scoreRound(round, order) });
  }

  function next() {
    if (!run) return;
    if (last) {
      game.finish(state.score);
      game.reward.submit({ slug: "chronologie", seed: run.seed, mode: data.mode, difficulty: run.difficulty, orders: state.orders });
      return;
    }
    setState({ ...state, round: state.round + 1, order: null, submitted: false });
  }

  return (
    <Panel className="space-y-4">
      <Progress current={state.round + 1} total={rounds} score={t(`Score : ${state.score}`, `Score: ${state.score}`)} />
      <p className="text-lg text-foam">{round.prompt}</p>
      <SortableList
        order={order}
        items={byId}
        expected={expected}
        submitted={state.submitted}
        onReorder={(next) => setState({ ...state, order: next })}
      />
      {state.submitted ? (
        <Button autoFocus onClick={next}>
          {last ? t("Voir mon score", "See my score") : t("Manche suivante", "Next round")}
        </Button>
      ) : (
        <Button onClick={submit}>{t("Valider", "Submit")}</Button>
      )}
    </Panel>
  );
}
