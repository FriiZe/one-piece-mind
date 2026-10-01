"use client";

import { useMemo, useState } from "react";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Button, Panel, Progress } from "../ui/primitives";
import { SortableList } from "../ui/SortableList";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import { correctOrder, MAX_SCORE, roundAt, ROUNDS, scoreRound } from "./logic";

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
  const base = useRun("chronologie");
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
          Cinq manches. À chaque fois, cinq arcs ou cinq personnages à remettre dans l&apos;ordre de l&apos;histoire, en les
          faisant glisser. Un point par élément au bon rang.
        </p>
      </GameStart>
    );
  }
  if (finished) return <GameEnd game={game} data={data} max={MAX_SCORE} />;

  const byId = new Map(round.items.map((item) => [item.id, item]));
  const order = state.order ?? round.items.map((item) => item.id);
  const expected = correctOrder(round);
  const last = state.round === ROUNDS - 1;

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
      <Progress current={state.round + 1} total={ROUNDS} score={`Score : ${state.score}`} />
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
          {last ? "Voir mon score" : "Manche suivante"}
        </Button>
      ) : (
        <Button onClick={submit}>Valider</Button>
      )}
    </Panel>
  );
}
