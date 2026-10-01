"use client";

import { useMemo, useState } from "react";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Portrait } from "../ui/Portrait";
import { Panel } from "../ui/primitives";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import { generateDeck, MAX_SCORE, scoreFor } from "./logic";

/** Temps pendant lequel deux cartes qui ne vont pas ensemble restent visibles. */
const FLIP_BACK_MS = 1000;

type Progression = {
  matched: number[];
  /** Cartes retournées par le coup en cours (une ou deux). */
  open: number[];
  flips: [number, number][];
};
const START: Progression = { matched: [], open: [], flips: [] };

export default function Memo({ data }: GameProps) {
  const base = useRun("memo");
  const [state, setState] = useState<Progression>(START);
  const game = {
    ...base,
    start: (difficulty: Parameters<typeof base.start>[0]) => {
      setState(START);
      base.start(difficulty);
    },
  };
  const { run, finished } = base;

  const deck = useMemo(() => (run ? generateDeck(run.seed, run.difficulty, data) : []), [run, data]);

  if (!run || !deck.length) {
    return (
      <GameStart game={game}>
        <p className="text-mist">
          Seize cartes, huit paires : chaque personnage va avec son fruit du démon. Retrouve-les en un minimum de coups.
        </p>
      </GameStart>
    );
  }
  if (finished) {
    return (
      <GameEnd game={game} data={data} max={MAX_SCORE}>
        <p>
          Toutes les paires en {state.flips.length} coup{state.flips.length > 1 ? "s" : ""}.
        </p>
      </GameEnd>
    );
  }

  function flip(index: number) {
    if (!run || state.open.length >= 2 || state.open.includes(index) || state.matched.includes(index)) return;
    if (state.open.length === 0) {
      setState({ ...state, open: [index] });
      return;
    }
    const first = state.open[0];
    const flips: [number, number][] = [...state.flips, [first, index]];
    if (deck[first].pair === deck[index].pair) {
      const matched = [...state.matched, first, index];
      setState({ matched, open: [], flips });
      if (matched.length === deck.length) {
        game.finish(scoreFor(flips.length));
        game.reward.submit({ slug: "memo", seed: run.seed, mode: data.mode, difficulty: run.difficulty, flips });
      }
      return;
    }
    setState({ ...state, open: [first, index], flips });
    window.setTimeout(() => setState((current) => ({ ...current, open: [] })), FLIP_BACK_MS);
  }

  return (
    <Panel className="space-y-4">
      <p className="text-sm font-semibold text-mist" aria-live="polite">
        {state.matched.length / 2} paire{state.matched.length / 2 > 1 ? "s" : ""} sur {deck.length / 2} · {state.flips.length} coup
        {state.flips.length > 1 ? "s" : ""}
      </p>
      <ul className="mx-auto grid max-w-xl grid-cols-4 gap-2">
        {deck.map((card, index) => {
          const isMatched = state.matched.includes(index);
          const visible = isMatched || state.open.includes(index);
          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => flip(index)}
                disabled={visible}
                aria-label={visible ? card.label : `Carte ${index + 1}, face cachée`}
                className={`flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 p-1 text-center text-xs font-bold transition-colors sm:text-sm ${
                  isMatched
                    ? "border-emerald-400 bg-emerald-600/20 text-foam"
                    : visible
                      ? "border-straw bg-sea-700 text-foam"
                      : "border-sea-600 bg-sea-700 text-straw hover:border-straw"
                }`}
              >
                {visible ? (
                  <>
                    {card.img && <Portrait img={card.img} className="mx-auto h-14 w-11 sm:h-20 sm:w-16" />}
                    <span className="line-clamp-3 break-words">{card.label}</span>
                  </>
                ) : (
                  <span className="font-display text-4xl">?</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
