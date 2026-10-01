"use client";

import { useMemo, useState } from "react";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, pick, randomSeed } from "../engine/rng";
import { formatBounty } from "../engine/text";
import { Button, ResultPanel } from "../ui/primitives";
import { StartScreen } from "../ui/StartScreen";
import { useBest } from "../ui/storage";
import type { GameProps } from "../ui/types";
import { bountyPool, isCorrect, nextOpponent, type Answer, type Bountied } from "./logic";

type Run = {
  seed: number;
  difficulty: Difficulty;
  current: Bountied;
  next: Bountied;
  streak: number;
  seen: string[];
  /** Réponse donnée à la manche en cours, tant que la prime dévoilée est affichée. */
  answer: Answer | null;
  lost: boolean;
  newBest: boolean;
};

function Card({ character, bounty, tone }: { character: Bountied; bounty: string; tone: "known" | "hidden" | "right" | "wrong" }) {
  const tones = {
    known: "border-sea-600",
    hidden: "border-straw",
    right: "border-emerald-400",
    wrong: "border-vest",
  };
  return (
    <div className={`flex-1 rounded-2xl border-2 bg-sea-800/70 p-5 text-center ${tones[tone]}`}>
      <p className="font-display text-3xl tracking-wide text-foam">{character.name}</p>
      <p className="min-h-6 text-sm text-mist">{character.altName ?? character.affiliation}</p>
      <p className="mt-3 font-display text-3xl tracking-wide text-straw">{bounty}</p>
    </div>
  );
}

export default function PlusOuMoins({ data }: GameProps) {
  const [run, setRun] = useState<Run | null>(null);
  const [best, submitBest] = useBest(`plus-ou-moins.${run?.difficulty ?? "normal"}`);
  const difficulty = run?.difficulty;
  const pool = useMemo(
    () => (difficulty ? bountyPool(byDifficulty(data.characters, difficulty)) : []),
    [data.characters, difficulty],
  );

  function start(level: Difficulty) {
    const seed = randomSeed();
    const rng = createRng(seed);
    const candidates = bountyPool(byDifficulty(data.characters, level));
    const current = pick(rng, candidates);
    const next = nextOpponent(rng, candidates, current, [current.id]);
    setRun({ seed, difficulty: level, current, next, streak: 0, seen: [current.id, next.id], answer: null, lost: false, newBest: false });
  }

  function answer(choice: Answer) {
    if (!run || run.answer) return;
    if (!isCorrect(run.current, run.next, choice)) {
      setRun({ ...run, answer: choice, lost: true, newBest: submitBest(run.streak) });
      return;
    }
    setRun({ ...run, answer: choice, streak: run.streak + 1 });
  }

  function advance() {
    if (!run) return;
    // Un tirage par manche, déterminé par la graine de la partie
    const rng = createRng(run.seed + run.streak);
    const next = nextOpponent(rng, pool, run.next, run.seen.slice(-12));
    setRun({ ...run, current: run.next, next, seen: [...run.seen, next.id], answer: null });
  }

  if (!run) {
    return (
      <StartScreen onStart={start}>
        <p className="text-mist">
          Deux avis de recherche. La prime du second est-elle plus haute ou plus basse que celle du premier ? Une seule
          erreur et la série s&apos;arrête.
        </p>
      </StartScreen>
    );
  }

  const revealed = run.answer !== null;
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-mist" aria-live="polite">
        Série en cours : <span className="text-foam">{run.streak}</span>
        {best !== null && <> · Record : {best}</>}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Card character={run.current} bounty={formatBounty(run.current.bounty)} tone="known" />
        <Card
          character={run.next}
          bounty={revealed ? formatBounty(run.next.bounty) : "? ? ?"}
          tone={!revealed ? "hidden" : run.lost ? "wrong" : "right"}
        />
      </div>

      {!revealed && (
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => answer("higher")}>▲ Plus haute</Button>
          <Button onClick={() => answer("lower")}>▼ Plus basse</Button>
        </div>
      )}
      {revealed && !run.lost && (
        <div className="flex items-center justify-between gap-3" aria-live="polite">
          <p className="font-bold text-emerald-300">Bien vu.</p>
          <Button autoFocus onClick={advance}>
            Continuer
          </Button>
        </div>
      )}
      {run.lost && (
        <ResultPanel
          title={`Série de ${run.streak}`}
          best={best !== null ? { label: "Record à ce niveau", value: String(best) } : null}
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
          <p>
            La prime de {run.next.name} est de {formatBounty(run.next.bounty)}, celle de {run.current.name} de{" "}
            {formatBounty(run.current.bounty)}.
          </p>
        </ResultPanel>
      )}
    </div>
  );
}
