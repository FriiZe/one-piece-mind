"use client";

import { useMemo, useState } from "react";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Button, Panel, Progress } from "../ui/primitives";
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
          Cinq manches. À chaque fois, cinq arcs ou cinq personnages à remettre dans l&apos;ordre de l&apos;histoire. Un
          point par élément au bon rang.
        </p>
      </GameStart>
    );
  }
  if (finished) return <GameEnd game={game} data={data} max={MAX_SCORE} />;

  const byId = new Map(round.items.map((item) => [item.id, item]));
  const order = state.order ?? round.items.map((item) => item.id);
  const expected = correctOrder(round);
  const last = state.round === ROUNDS - 1;

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setState({ ...state, order: next });
  }

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
      <ol className="space-y-2">
        {order.map((id, index) => {
          const item = byId.get(id)!;
          const right = state.submitted && expected[index] === id;
          return (
            <li
              key={id}
              className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 ${
                !state.submitted ? "border-sea-600 bg-sea-700" : right ? "border-emerald-400 bg-emerald-600/20" : "border-vest bg-vest/20"
              }`}
            >
              <span className="w-6 text-center font-display text-2xl text-straw">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-foam">{item.label}</span>
                {state.submitted && (
                  <span className="block text-sm text-mist">
                    {item.detail}
                    {!right && ` · rang attendu : ${expected.indexOf(id) + 1}`}
                  </span>
                )}
              </span>
              {!state.submitted && (
                <span className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Monter ${item.label}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="h-10 w-10 rounded-lg bg-sea-600 text-lg text-foam hover:bg-straw hover:text-ink disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Descendre ${item.label}`}
                    disabled={index === order.length - 1}
                    onClick={() => move(index, 1)}
                    className="h-10 w-10 rounded-lg bg-sea-600 text-lg text-foam hover:bg-straw hover:text-ink disabled:opacity-30"
                  >
                    ▼
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
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
