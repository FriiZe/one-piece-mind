"use client";

import { useMemo, useState } from "react";
import type { PlayCharacter } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { randomSeed } from "../engine/rng";
import { formatBounty, formatHeight } from "../engine/text";
import { Button, Panel, Progress, ResultPanel } from "../ui/primitives";
import { StartScreen } from "../ui/StartScreen";
import { useBest } from "../ui/storage";
import type { GameProps } from "../ui/types";
import { RewardSummary } from "@/components/RewardSummary";
import { useGameReward } from "@/lib/player/useGameReward";
import { CRITERIA, correctOrder, MAX_SCORE, roundAt, ROUNDS, type Criterion } from "./logic";

function formatValue(character: PlayCharacter, criterion: Criterion): string {
  if (criterion === "bounty") return formatBounty(character.bounty);
  if (criterion === "height") return formatHeight(character.height);
  return `${character.age} ans`;
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
  const [run, setRun] = useState<Run | null>(null);
  const [best, submitBest] = useBest(`le-classement.${run?.difficulty ?? "normal"}`);
  const reward = useGameReward();

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
      seed: randomSeed(),
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
          Cinq manches. À chaque fois, cinq personnages à ranger selon leur prime, leur taille ou leur âge. Un point par
          personnage au bon rang.
        </p>
      </StartScreen>
    );
  }

  if (run.finished) {
    return (
      <ResultPanel
        title={`${run.score} / ${MAX_SCORE}`}
        best={best !== null ? { label: "Record à ce niveau", value: `${best} / ${MAX_SCORE}` } : null}
        newBest={run.newBest}
        actions={
          <>
            <Button onClick={() => start(run.difficulty)}>Rejouer</Button>
            <Button variant="secondary" onClick={() => setRun(null)}>
              Changer de difficulté
            </Button>
          </>
        }
      >
        <RewardSummary view={reward.view} data={data} />
      </ResultPanel>
    );
  }

  const byId = new Map(round.items.map((c) => [c.id, c]));
  const order = run.order ?? round.items.map((c) => c.id);
  const expected = correctOrder(round);
  const criterion = CRITERIA[round.criterion];

  function move(index: number, delta: -1 | 1) {
    if (!run) return;
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const nextOrder = [...order];
    [nextOrder[index], nextOrder[target]] = [nextOrder[target], nextOrder[index]];
    setRun({ ...run, order: nextOrder });
  }

  function submit() {
    if (!run) return;
    const points = order.filter((id, index) => expected[index] === id).length;
    setRun({ ...run, order, submitted: true, orders: [...run.orders, order], score: run.score + points });
  }

  function next() {
    if (!run) return;
    if (run.round === ROUNDS - 1) {
      setRun({ ...run, finished: true, newBest: submitBest(run.score) });
      reward.submit({ slug: "le-classement", seed: run.seed, mode: data.mode, difficulty: run.difficulty, orders: run.orders });
      return;
    }
    setRun({ ...run, round: run.round + 1, order: null, submitted: false });
  }

  return (
    <Panel className="space-y-4">
      <Progress current={run.round + 1} total={ROUNDS} score={`Score : ${run.score}`} />
      <p className="text-lg text-foam">
        Range ces personnages par <strong className="text-straw">{criterion.label}</strong>, {criterion.order}.
      </p>
      <ol className="space-y-2">
        {order.map((id, index) => {
          const character = byId.get(id)!;
          const right = run.submitted && expected[index] === id;
          return (
            <li
              key={id}
              className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 ${
                !run.submitted ? "border-sea-600 bg-sea-700" : right ? "border-emerald-400 bg-emerald-600/20" : "border-vest bg-vest/20"
              }`}
            >
              <span className="w-6 text-center font-display text-2xl text-straw">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-foam">{character.name}</span>
                {run.submitted && (
                  <span className="block text-sm text-mist">
                    {formatValue(character, round.criterion)}
                    {!right && ` · rang attendu : ${expected.indexOf(id) + 1}`}
                  </span>
                )}
              </span>
              {!run.submitted && (
                <span className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Monter ${character.name}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="h-10 w-10 rounded-lg bg-sea-600 text-lg text-foam hover:bg-straw hover:text-ink disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Descendre ${character.name}`}
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
      {run.submitted ? (
        <Button autoFocus onClick={next}>
          {run.round === ROUNDS - 1 ? "Voir mon score" : "Manche suivante"}
        </Button>
      ) : (
        <Button onClick={submit}>Valider</Button>
      )}
    </Panel>
  );
}
