"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { portraitUrl, type PlayCharacter } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, randomSeed } from "../engine/rng";
import { formatNumber } from "../engine/text";
import { CharacterSearch } from "../ui/CharacterSearch";
import { GuessHistory } from "../ui/GuessHistory";
import { Button, Correction, Progress, ResultPanel } from "../ui/primitives";
import { StartScreen } from "../ui/StartScreen";
import { useBest } from "../ui/storage";
import type { GameProps } from "../ui/types";
import { RewardSummary } from "@/components/RewardSummary";
import { useLocale, useT } from "@/lib/i18n/client";
import { useGameReward } from "@/lib/player/useGameReward";
import { generatePosters, hintsFor, isAccepted, MAX_SCORE, pointsFor, type PosterEvent } from "./logic";

type Run = {
  seed: number;
  difficulty: Difficulty;
  index: number;
  /** Nombre d'indices dévoilés sur l'affiche en cours. */
  revealed: number;
  wrong: string[];
  /** Actions du joueur, affiche par affiche, pour le compte rendu de partie. */
  log: PosterEvent[][];
  /** Issue de l'affiche en cours : points gagnés, ou `null` tant qu'elle est en jeu. */
  outcome: number | null;
  score: number;
  finished: boolean;
  newBest: boolean;
};

/** `name` et `img` ne sont donnés qu'une fois l'affiche résolue. */
function Poster({ bounty, name, img }: { bounty: number; name: string | null; img?: string | null }) {
  const locale = useLocale();
  return (
    <div className="mx-auto w-full max-w-xs rounded-md border-4 border-parchment-dark bg-parchment p-4 text-center text-ink shadow-xl">
      <p className="font-display text-5xl tracking-widest">WANTED</p>
      <div className="relative mx-auto my-3 flex aspect-[2/1] items-center justify-center overflow-hidden bg-ink/15 font-display text-7xl text-ink/40 sm:aspect-[4/3]">
        {img ? <Image src={portraitUrl(img)} alt="" fill sizes="320px" className="object-cover object-top" /> : "?"}
      </div>
      <p className="text-xs font-bold tracking-[0.3em]">DEAD OR ALIVE</p>
      <p className="mt-1 min-h-9 font-display text-3xl tracking-wide">{name ?? "· · ·"}</p>
      <p className="mt-1 border-t-2 border-ink/30 pt-2 font-display text-3xl tracking-wide">
        <span className="mr-1">฿</span>
        {formatNumber(bounty, locale)}
      </p>
    </div>
  );
}

export default function AvisDeRecherche({ data }: GameProps) {
  const t = useT();
  const [run, setRun] = useState<Run | null>(null);
  const [best, submitBest] = useBest(`avis-de-recherche.${run?.difficulty ?? "normal"}`);
  const reward = useGameReward();

  const seed = run?.seed;
  const difficulty = run?.difficulty;
  const posters = useMemo(
    () =>
      seed === undefined || difficulty === undefined
        ? []
        : generatePosters(createRng(seed), byDifficulty(data.characters, difficulty)),
    [data.characters, seed, difficulty],
  );

  function start(level: Difficulty) {
    reward.reset();
    setRun({
      seed: randomSeed(),
      difficulty: level,
      index: 0,
      revealed: 0,
      wrong: [],
      log: [[]],
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
          {t(
            "Cinq avis de recherche sans nom ni photo. Chaque erreur dévoile un indice, et chaque indice coûte un point.",
            "Five wanted posters with no name and no photo. Each wrong guess reveals a hint, and each hint costs a point.",
          )}
        </p>
      </StartScreen>
    );
  }

  if (run.finished) {
    return (
      <ResultPanel
        title={`${run.score} / ${MAX_SCORE}`}
        best={
          best !== null
            ? { label: t("Record à ce niveau", "Best at this level"), value: `${best} / ${MAX_SCORE}` }
            : null
        }
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

  const target = posters[run.index];
  /** Ajoute une action au journal de l'affiche en cours. */
  const logged = (event: PosterEvent) => run.log.map((events, i) => (i === run.index ? [...events, event] : events));
  const hints = hintsFor(target, data);
  const done = run.outcome !== null;
  const excluded = new Set(run.wrong);

  function guess(character: PlayCharacter) {
    if (!run || done) return;
    const log = logged({ type: "guess", id: character.id });
    if (isAccepted(character, target, run.revealed, data)) {
      const points = pointsFor(run.revealed);
      setRun({ ...run, log, outcome: points, score: run.score + points });
      return;
    }
    const wrong = [...run.wrong, character.id];
    // Une erreur dévoile l'indice suivant ; sans indice restant, l'affiche est perdue
    if (run.revealed >= hints.length) setRun({ ...run, log, wrong, outcome: 0 });
    else setRun({ ...run, log, wrong, revealed: run.revealed + 1 });
  }

  function next() {
    if (!run) return;
    if (run.index === posters.length - 1) {
      setRun({ ...run, finished: true, newBest: submitBest(run.score) });
      reward.submit({ slug: "avis-de-recherche", seed: run.seed, mode: data.mode, difficulty: run.difficulty, posters: run.log });
      return;
    }
    setRun({ ...run, index: run.index + 1, revealed: 0, wrong: [], log: [...run.log, []], outcome: null });
  }

  return (
    <div className="space-y-4">
      <Progress
        current={run.index + 1}
        total={posters.length}
        score={t(`Score : ${run.score}`, `Score: ${run.score}`)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Poster bounty={target.bounty} name={done ? target.name : null} img={done ? target.img : null} />

        <div className="space-y-3">
          <ul className="space-y-2" aria-label={t("Indices", "Hints")} aria-live="polite">
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
                label={t("Qui est recherché ?", "Who's wanted?")}
                placeholder={t("Qui est recherché ?", "Who's wanted?")}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-mist">
                <span>
                  {t(
                    `Cette affiche vaut encore ${pointsFor(run.revealed)} point${pointsFor(run.revealed) > 1 ? "s" : ""}.`,
                    `This poster is still worth ${pointsFor(run.revealed)} point${pointsFor(run.revealed) === 1 ? "" : "s"}.`,
                  )}
                </span>
                <span className="flex gap-4">
                  {run.revealed < hints.length && (
                    <button
                      type="button"
                      className="underline underline-offset-4 hover:text-foam"
                      onClick={() => setRun({ ...run, log: logged({ type: "hint" }), revealed: run.revealed + 1 })}
                    >
                      {t("Un indice", "Hint")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="underline underline-offset-4 hover:text-foam"
                    onClick={() => setRun({ ...run, log: logged({ type: "pass" }), outcome: 0 })}
                  >
                    {t("Passer", "Skip")}
                  </button>
                </span>
              </div>
            </>
          )}

          <GuessHistory ids={run.wrong} characterById={data.characterById} />

          {done && (
            <Correction
              action={
                <Button autoFocus onClick={next}>
                  {run.index === posters.length - 1
                    ? t("Voir mon score", "See my score")
                    : t("Affiche suivante", "Next poster")}
                </Button>
              }
            >
              <p className={`font-bold ${run.outcome ? "text-emerald-300" : "text-vest"}`}>
                {run.outcome
                  ? t(
                      `Trouvé : +${run.outcome} point${run.outcome > 1 ? "s" : ""}.`,
                      `Got it: +${run.outcome} point${run.outcome === 1 ? "" : "s"}.`,
                    )
                  : t(`C'était ${target.name}.`, `It was ${target.name}.`)}
              </p>
            </Correction>
          )}
        </div>
      </div>
    </div>
  );
}
