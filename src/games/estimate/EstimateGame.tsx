"use client";

import { useMemo, useState } from "react";
import { formatBounty, formatNumber } from "../engine/text";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Portrait } from "../ui/Portrait";
import { Button, Panel, Progress } from "../ui/primitives";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import {
  generateEstimates,
  parseEstimate,
  POINTS_PER_QUESTION,
  scoreEstimate,
  sliderToValue,
  usesDifficulty,
  valueToSlider,
  type EstimateQuestion,
  type EstimateSlug,
} from "./logic";

const INTROS: Record<EstimateSlug, string> = {
  "devine-la-prime": "Huit personnages primés. Estime la prime de chacun : plus tu es proche, plus tu marques.",
  "premiere-apparition": "Huit personnages. À quel moment de l'histoire chacun apparaît-il pour la première fois ?",
  "prime-d-equipage": "Huit équipages. Estime le total des primes connues de leurs membres.",
};

const SLIDER_STEPS = 1000;
const NOT_TYPED = { text: "", value: null };

function format(question: EstimateQuestion, value: number): string {
  if (question.unit === "berrys") return formatBounty(value);
  return `${question.unit === "chapitre" ? "Chapitre" : "Épisode"} ${formatNumber(value)}`;
}

export default function EstimateGame({ data, slug }: GameProps & { slug: EstimateSlug }) {
  const base = useRun(slug);
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState(SLIDER_STEPS / 2);
  // Valeur tapée au clavier : elle prime sur le curseur tant qu'il n'est pas déplacé
  const [typed, setTyped] = useState<{ text: string; value: number | null }>(NOT_TYPED);
  const [answers, setAnswers] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const game = {
    ...base,
    start: (difficulty: Parameters<typeof base.start>[0]) => {
      setIndex(0);
      setPosition(SLIDER_STEPS / 2);
      setTyped(NOT_TYPED);
      setAnswers([]);
      setScore(0);
      base.start(difficulty);
    },
  };
  const { run, finished } = base;
  const withDifficulty = usesDifficulty(slug);

  const questions = useMemo(
    () => (run ? generateEstimates(slug, run.seed, run.difficulty, data) : []),
    [slug, run, data],
  );
  const max = questions.length * POINTS_PER_QUESTION;

  if (!run || !questions.length) {
    return (
      <GameStart game={game} withDifficulty={withDifficulty}>
        <p className="text-mist">{INTROS[slug]}</p>
      </GameStart>
    );
  }
  if (finished) return <GameEnd game={game} data={data} max={max} withDifficulty={withDifficulty} />;

  const question = questions[index];
  const guess = typed.value ?? sliderToValue(question, position / SLIDER_STEPS);
  const answered = answers.length > index;
  const points = answered ? scoreEstimate(question, answers[index]) : 0;
  const last = index === questions.length - 1;

  function validate() {
    setAnswers([...answers, guess]);
    setScore(score + scoreEstimate(question, guess));
  }

  function next() {
    if (!run) return;
    if (last) {
      game.finish(score);
      game.reward.submit({ slug, seed: run.seed, mode: data.mode, difficulty: run.difficulty, answers });
      return;
    }
    setIndex(index + 1);
    setPosition(SLIDER_STEPS / 2);
    setTyped(NOT_TYPED);
  }

  function type(text: string) {
    const parsed = parseEstimate(text);
    const value = parsed === null ? null : Math.min(question.max, Math.max(question.min, parsed));
    setTyped({ text, value });
    if (value !== null) setPosition(Math.round(valueToSlider(question, value) * SLIDER_STEPS));
  }

  return (
    <Panel className="space-y-4">
      <Progress current={index + 1} total={questions.length} score={`Score : ${score}`} />
      <div className="space-y-2 text-center">
        <p className="text-mist">{question.title}</p>
        {question.img && <Portrait img={question.img} />}
        <p className="font-display text-3xl tracking-wide text-straw">{question.subject}</p>
        {question.detail && <p className="text-mist">{question.detail}</p>}
      </div>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!answered) validate();
        }}
      >
        <div className="space-y-2">
          <p className="text-center font-display text-4xl tracking-wide text-foam" aria-live="polite">
            {format(question, answered ? answers[index] : guess)}
          </p>
          <label className="block">
            <span className="sr-only">Ton estimation, au curseur</span>
            <input
              type="range"
              min={0}
              max={SLIDER_STEPS}
              step={1}
              value={position}
              disabled={answered}
              onChange={(event) => {
                setPosition(Number(event.target.value));
                setTyped(NOT_TYPED);
              }}
              aria-valuetext={format(question, guess)}
              className="w-full accent-straw"
            />
          </label>
          <div className="flex justify-between text-xs text-mist">
            <span>{format(question, question.min)}</span>
            <span>{format(question, question.max)}</span>
          </div>
        </div>

        {/* Deux blocs distincts (clés) : le bouton « Suivant » doit apparaître, et non remplacer « Valider », pour prendre la main */}
        {answered ? (
          <div key="correction" className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
            <p className="text-mist">
              <strong className={points >= 3 ? "text-emerald-300" : points > 0 ? "text-straw" : "text-vest"}>
                {points > 0 ? `+${points} point${points > 1 ? "s" : ""}.` : "Trop loin."}
              </strong>{" "}
              La bonne réponse : {format(question, question.answer)}.
            </p>
            <Button autoFocus onClick={next}>
              {last ? "Voir mon score" : "Suivant"}
            </Button>
          </div>
        ) : (
          <div key="saisie" className="flex flex-wrap items-start gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Ton estimation, au clavier</span>
              <input
                type="text"
                inputMode={question.unit === "berrys" ? "text" : "numeric"}
                value={typed.text}
                onChange={(event) => type(event.target.value)}
                autoComplete="off"
                placeholder={question.unit === "berrys" ? "Ou tape un montant : 320 M, 1,5 Md…" : "Ou tape un numéro…"}
                aria-invalid={typed.text !== "" && typed.value === null}
                className="w-full rounded-lg border-2 border-sea-600 bg-sea-900 px-4 py-2.5 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none aria-invalid:border-vest"
              />
              <span className="mt-1 block min-h-5 text-sm text-vest" aria-live="polite">
                {typed.text !== "" && typed.value === null ? "Ce n'est pas un nombre." : ""}
              </span>
            </label>
            <Button type="submit">Valider</Button>
          </div>
        )}
      </form>
    </Panel>
  );
}
