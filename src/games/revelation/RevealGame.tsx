"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { portraitUrl, type PlayCharacter } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, randomSeed } from "../engine/rng";
import { CharacterSearch } from "../ui/CharacterSearch";
import { GuessHistory } from "../ui/GuessHistory";
import { Button, Progress, ResultPanel } from "../ui/primitives";
import { StartScreen } from "../ui/StartScreen";
import { useBest } from "../ui/storage";
import type { GameProps } from "../ui/types";
import { RewardSummary } from "@/components/RewardSummary";
import type { Localized } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { useGameReward } from "@/lib/player/useGameReward";
import {
  generateRounds,
  MAX_SCORE,
  PIXEL_COLUMNS,
  pointsFor,
  STEPS,
  ZOOM_FACTORS,
  zoomFocus,
  zoomWindow,
  type RevealEvent,
  type Variant,
} from "./logic";

type Focus = { x: number; y: number };

/**
 * L'image mystère est dessinée dans un canevas : elle n'apparaît jamais nette
 * dans la page tant que la manche n'est pas terminée.
 */
function MysteryImage({
  src,
  variant,
  step,
  revealed,
  focus,
}: {
  src: string;
  variant: Variant;
  step: number;
  revealed: boolean;
  focus: Focus;
}) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const loading = new Image();
    loading.onload = () => setImage(loading);
    loading.src = src;
    return () => {
      loading.onload = null;
    };
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !image) return;
    const { naturalWidth: width, naturalHeight: height } = image;
    canvas.width = width;
    canvas.height = height;

    if (revealed) {
      context.drawImage(image, 0, 0);
    } else if (variant === "pixel") {
      // Réduire l'image à quelques pavés, puis l'agrandir sans lissage
      const columns = PIXEL_COLUMNS[step];
      const rows = Math.max(1, Math.round((columns * height) / width));
      const small = document.createElement("canvas");
      small.width = columns;
      small.height = rows;
      small.getContext("2d")!.drawImage(image, 0, 0, columns, rows);
      context.imageSmoothingEnabled = false;
      context.drawImage(small, 0, 0, columns, rows, 0, 0, width, height);
    } else {
      const view = zoomWindow(width, height, focus, ZOOM_FACTORS[step]);
      context.drawImage(image, view.x, view.y, view.width, view.height, 0, 0, width, height);
    }
  }, [image, variant, step, revealed, focus]);

  return (
    <div className="flex h-[min(46vh,24rem)] justify-center">
      {/* Dimensions par défaut au format portrait, le temps que l'image se charge */}
      <canvas
        ref={canvasRef}
        width={230}
        height={345}
        role="img"
        aria-label={revealed ? t("Portrait du personnage", "Character portrait") : t("Image mystère", "Mystery picture")}
        className="h-full w-auto max-w-full rounded-xl border-2 border-sea-600 bg-sea-900"
      />
    </div>
  );
}

type Run = {
  seed: number;
  difficulty: Difficulty;
  index: number;
  step: number;
  wrong: string[];
  /** Actions du joueur, image par image, pour le compte rendu de partie. */
  log: RevealEvent[][];
  /** Points gagnés sur l'image en cours, `null` tant qu'elle est en jeu. */
  outcome: number | null;
  score: number;
  finished: boolean;
  newBest: boolean;
};

const INTRO: Record<Variant, Localized> = {
  pixel: {
    fr: "Huit portraits pixelisés. L'image ne se précise qu'après chaque proposition : moins il t'en faut, plus tu marques.",
    en: "Eight pixelated portraits. The picture only sharpens after each guess: the fewer you need, the more you score.",
  },
  zoom: {
    fr: "Huit portraits vus de très près. L'image ne dézoome qu'après chaque proposition : moins il t'en faut, plus tu marques.",
    en: "Eight portraits seen from very close up. The picture only zooms out after each guess: the fewer you need, the more you score.",
  },
};

export function RevealGame({ data, variant }: GameProps & { variant: Variant }) {
  const t = useT();
  const locale = useLocale();
  const slug = variant === "pixel" ? "revelation" : "zoom-extreme";
  const [run, setRun] = useState<Run | null>(null);
  const [best, submitBest] = useBest(`${slug}.${run?.difficulty ?? "normal"}`);
  const reward = useGameReward();

  const seed = run?.seed;
  const difficulty = run?.difficulty;
  const rounds = useMemo(
    () =>
      seed === undefined || difficulty === undefined
        ? []
        : generateRounds(createRng(seed), byDifficulty(data.characters, difficulty)),
    [data.characters, seed, difficulty],
  );
  const index = run?.index ?? 0;
  const focus = useMemo(() => zoomFocus(createRng((seed ?? 0) + index + 1)), [seed, index]);

  function start(level: Difficulty) {
    reward.reset();
    setRun({
      seed: randomSeed(),
      difficulty: level,
      index: 0,
      step: 0,
      wrong: [],
      log: [[]],
      outcome: null,
      score: 0,
      finished: false,
      newBest: false,
    });
  }

  if (!run || !rounds.length) {
    return (
      <StartScreen onStart={start}>
        <p className="text-mist">{INTRO[variant][locale]}</p>
      </StartScreen>
    );
  }

  if (run.finished) {
    return (
      <ResultPanel
        title={`${run.score} / ${MAX_SCORE}`}
        best={best !== null ? { label: t("Record à ce niveau", "Best at this level"), value: `${best} / ${MAX_SCORE}` } : null}
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

  const target = rounds[run.index];
  /** Ajoute une action au journal de l'image en cours. */
  const logged = (event: RevealEvent) => run.log.map((events, i) => (i === run.index ? [...events, event] : events));
  const done = run.outcome !== null;
  const last = run.index === rounds.length - 1;

  function guess(character: PlayCharacter) {
    if (!run || done) return;
    const log = logged({ type: "guess", id: character.id });
    if (character.id === target.id) {
      const points = pointsFor(run.step);
      setRun({ ...run, log, outcome: points, score: run.score + points });
      return;
    }
    const wrong = [...run.wrong, character.id];
    // L'image n'avance que sur une erreur ; au dernier palier, elle est perdue
    if (run.step >= STEPS - 1) setRun({ ...run, log, wrong, outcome: 0 });
    else setRun({ ...run, log, wrong, step: run.step + 1 });
  }

  function next() {
    if (!run) return;
    if (last) {
      setRun({ ...run, finished: true, newBest: submitBest(run.score) });
      reward.submit({ slug, seed: run.seed, mode: data.mode, difficulty: run.difficulty, rounds: run.log });
      return;
    }
    setRun({ ...run, index: run.index + 1, step: 0, wrong: [], log: [...run.log, []], outcome: null });
  }

  return (
    <div className="space-y-4">
      <Progress current={run.index + 1} total={rounds.length} score={t(`Score : ${run.score}`, `Score: ${run.score}`)} />
      <MysteryImage
        key={target.id}
        src={portraitUrl(target.img)}
        variant={variant}
        step={run.step}
        revealed={done}
        focus={focus}
      />

      {!done && (
        <>
          <CharacterSearch
            characters={data.characters}
            excludeIds={new Set(run.wrong)}
            onPick={guess}
            label={t("Qui est-ce ?", "Who is it?")}
            placeholder={t("Qui est-ce ?", "Who is it?")}
          />
          <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-mist" aria-live="polite">
            <span>
              {t(
                `Palier ${run.step + 1} sur ${STEPS} : cette image vaut encore ${pointsFor(run.step)} point${pointsFor(run.step) > 1 ? "s" : ""}.`,
                `Stage ${run.step + 1} of ${STEPS}: this picture is still worth ${pointsFor(run.step)} ${pointsFor(run.step) === 1 ? "point" : "points"}.`,
              )}
            </span>
            <span className="flex gap-4">
              {/* Sans idée, on peut faire avancer l'image sans nommer quelqu'un : cela coûte autant qu'une erreur */}
              {run.step < STEPS - 1 && (
                <button
                  type="button"
                  className="underline underline-offset-4 hover:text-foam"
                  onClick={() => setRun({ ...run, log: logged({ type: "hint" }), step: run.step + 1 })}
                >
                  {variant === "pixel"
                    ? t("Aucune idée : préciser l'image", "No idea: sharpen the picture")
                    : t("Aucune idée : dézoomer", "No idea: zoom out")}
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
          </p>
        </>
      )}

      <GuessHistory ids={run.wrong} characterById={data.characterById} />

      {done && (
        <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
          <p className={`font-bold ${run.outcome ? "text-emerald-300" : "text-vest"}`}>
            {run.outcome
              ? t(
                  `${target.name} : +${run.outcome} point${run.outcome > 1 ? "s" : ""}.`,
                  `${target.name}: +${run.outcome} ${run.outcome === 1 ? "point" : "points"}.`,
                )
              : t(`C'était ${target.name}.`, `It was ${target.name}.`)}
          </p>
          <Button autoFocus onClick={next}>
            {last ? t("Voir mon score", "See my score") : t("Image suivante", "Next picture")}
          </Button>
        </div>
      )}
    </div>
  );
}
