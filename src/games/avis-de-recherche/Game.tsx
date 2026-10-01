"use client";

import { useMemo, useState } from "react";
import type { PlayCharacter } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, randomSeed } from "../engine/rng";
import { formatNumber } from "../engine/text";
import { CharacterSearch } from "../ui/CharacterSearch";
import { Button, Progress, ResultPanel } from "../ui/primitives";
import { StartScreen } from "../ui/StartScreen";
import { useBest } from "../ui/storage";
import type { GameProps } from "../ui/types";
import { generatePosters, hintsFor, isAccepted, MAX_POINTS, pointsFor } from "./logic";

const POSTERS = 5;
const MAX_SCORE = POSTERS * MAX_POINTS;

type Run = {
  seed: number;
  difficulty: Difficulty;
  index: number;
  /** Nombre d'indices dévoilés sur l'affiche en cours. */
  revealed: number;
  wrong: string[];
  /** Issue de l'affiche en cours : points gagnés, ou `null` tant qu'elle est en jeu. */
  outcome: number | null;
  score: number;
  finished: boolean;
  newBest: boolean;
};

function Poster({ bounty, name }: { bounty: number; name: string | null }) {
  return (
    <div className="mx-auto w-full max-w-xs rounded-md border-4 border-parchment-dark bg-parchment p-4 text-center text-ink shadow-xl">
      <p className="font-display text-5xl tracking-widest">WANTED</p>
      <div className="mx-auto my-3 flex aspect-[2/1] items-center sm:aspect-[4/3] justify-center bg-ink/15 font-display text-7xl text-ink/40">
        ?
      </div>
      <p className="text-xs font-bold tracking-[0.3em]">DEAD OR ALIVE</p>
      <p className="mt-1 min-h-9 font-display text-3xl tracking-wide">{name ?? "· · ·"}</p>
      <p className="mt-1 border-t-2 border-ink/30 pt-2 font-display text-3xl tracking-wide">
        <span className="mr-1">฿</span>
        {formatNumber(bounty)}
      </p>
    </div>
  );
}

export default function AvisDeRecherche({ data }: GameProps) {
  const [run, setRun] = useState<Run | null>(null);
  const [best, submitBest] = useBest(`avis-de-recherche.${run?.difficulty ?? "normal"}`);

  const seed = run?.seed;
  const difficulty = run?.difficulty;
  const posters = useMemo(
    () =>
      seed === undefined || difficulty === undefined
        ? []
        : generatePosters(createRng(seed), byDifficulty(data.characters, difficulty), POSTERS),
    [data.characters, seed, difficulty],
  );

  function start(level: Difficulty) {
    setRun({
      seed: randomSeed(),
      difficulty: level,
      index: 0,
      revealed: 0,
      wrong: [],
      outcome: null,
      score: 0,
      finished: false,
      newBest: false,
    });
  }

  if (!run || !posters.length) {
    return (
      <StartScreen onStart={start}>
        <p className="text-mist">
          Cinq avis de recherche sans nom ni photo. Chaque erreur dévoile un indice, et chaque indice coûte un point.
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
      />
    );
  }

  const target = posters[run.index];
  const hints = hintsFor(target, data);
  const done = run.outcome !== null;
  const excluded = new Set(run.wrong);

  function guess(character: PlayCharacter) {
    if (!run || done) return;
    if (isAccepted(character, target, run.revealed, data)) {
      const points = pointsFor(run.revealed);
      setRun({ ...run, outcome: points, score: run.score + points });
      return;
    }
    const wrong = [...run.wrong, character.id];
    // Une erreur dévoile l'indice suivant ; sans indice restant, l'affiche est perdue
    if (run.revealed >= hints.length) setRun({ ...run, wrong, outcome: 0 });
    else setRun({ ...run, wrong, revealed: run.revealed + 1 });
  }

  function next() {
    if (!run) return;
    if (run.index === posters.length - 1) {
      setRun({ ...run, finished: true, newBest: submitBest(run.score) });
      return;
    }
    setRun({ ...run, index: run.index + 1, revealed: 0, wrong: [], outcome: null });
  }

  return (
    <div className="space-y-4">
      <Progress current={run.index + 1} total={posters.length} score={`Score : ${run.score}`} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Poster bounty={target.bounty} name={done ? target.name : null} />

        <div className="space-y-3">
          <ul className="space-y-2" aria-label="Indices" aria-live="polite">
            {hints.map((hint, index) => (
              <li key={hint.key} className="rounded-lg border border-sea-600 bg-sea-800/70 px-3 py-2">
                <span className="block text-xs font-semibold tracking-wide text-mist uppercase">{hint.title}</span>
                <span className="font-bold text-foam">{index < run.revealed || done ? hint.value : "· · ·"}</span>
              </li>
            ))}
          </ul>

          {!done && (
            <>
              <CharacterSearch
                characters={data.characters}
                excludeIds={excluded}
                onPick={guess}
                label="Qui est recherché ?"
                placeholder="Qui est recherché ?"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-mist">
                <span>
                  Cette affiche vaut encore {pointsFor(run.revealed)} point{pointsFor(run.revealed) > 1 ? "s" : ""}.
                </span>
                <span className="flex gap-4">
                  {run.revealed < hints.length && (
                    <button
                      type="button"
                      className="underline underline-offset-4 hover:text-foam"
                      onClick={() => setRun({ ...run, revealed: run.revealed + 1 })}
                    >
                      Un indice
                    </button>
                  )}
                  <button
                    type="button"
                    className="underline underline-offset-4 hover:text-foam"
                    onClick={() => setRun({ ...run, outcome: 0 })}
                  >
                    Passer
                  </button>
                </span>
              </div>
            </>
          )}

          {done && (
            <div className="space-y-3" aria-live="polite">
              <p className={`font-bold ${run.outcome ? "text-emerald-300" : "text-vest"}`}>
                {run.outcome
                  ? `Trouvé : +${run.outcome} point${run.outcome > 1 ? "s" : ""}.`
                  : `C'était ${target.name}.`}
              </p>
              <Button autoFocus onClick={next}>
                {run.index === posters.length - 1 ? "Voir mon score" : "Affiche suivante"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
