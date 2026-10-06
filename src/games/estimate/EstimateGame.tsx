"use client";

import { useRoundLimit } from "../ui/roomRound";
import { useMemo, useState } from "react";
import { formatBounty, formatNumber } from "../engine/text";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Portrait } from "../ui/Portrait";
import { Button, Correction, Panel, Progress } from "../ui/primitives";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import type { Locale, Localized } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import {
  generateEstimates,
  parseEstimate,
  maxPoints,
  scoreEstimate,
  sliderToValue,
  usesDifficulty,
  valueToSlider,
  type EstimateQuestion,
  type EstimateSlug,
} from "./logic";

const INTROS: Record<EstimateSlug, Localized> = {
  "devine-la-prime": {
    fr: "Huit personnages primés. Estime la prime de chacun : plus tu es proche, plus tu marques.",
    en: "Eight characters with a bounty. Estimate each one's bounty: the closer you are, the more you score.",
  },
  "premiere-apparition": {
    fr: "Huit personnages. À quel moment de l'histoire chacun apparaît-il pour la première fois ?",
    en: "Eight characters. At what point in the story does each one first appear?",
  },
  "prime-d-equipage": {
    fr: "Huit équipages. Estime le total des primes connues de leurs membres.",
    en: "Eight crews. Estimate the total of their members' known bounties.",
  },
};

/** Libellé des unités autres que les Berrys : `unit` est un code, pas un texte à afficher. */
const UNIT_LABELS: Record<Exclude<EstimateQuestion["unit"], "berrys">, Localized> = {
  chapitre: { fr: "Chapitre", en: "Chapter" },
  épisode: { fr: "Épisode", en: "Episode" },
};

/** Crans du curseur sur une échelle logarithmique ; sur une échelle linéaire, il y en a un par valeur. */
const SLIDER_STEPS = 1000;
const NOT_TYPED = { text: "", value: null };

function format(question: EstimateQuestion, value: number, locale: Locale): string {
  if (question.unit === "berrys") return formatBounty(value, locale);
  return `${UNIT_LABELS[question.unit][locale]} ${formatNumber(value, locale)}`;
}

export default function EstimateGame({ data, slug }: GameProps & { slug: EstimateSlug }) {
  const t = useT();
  const locale = useLocale();
  const base = useRun(slug);
  const limit = useRoundLimit();
  const [index, setIndex] = useState(0);
  /** Position du curseur, de 0 à 1. */
  const [position, setPosition] = useState(0.5);
  // Valeur tapée au clavier : elle prime sur le curseur tant qu'il n'est pas déplacé
  const [typed, setTyped] = useState<{ text: string; value: number | null }>(NOT_TYPED);
  const [answers, setAnswers] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const game = {
    ...base,
    start: (difficulty: Parameters<typeof base.start>[0]) => {
      setIndex(0);
      setPosition(0.5);
      setTyped(NOT_TYPED);
      setAnswers([]);
      setScore(0);
      base.start(difficulty);
    },
  };
  const { run, finished } = base;
  const withDifficulty = usesDifficulty(slug);

  const questions = useMemo(
    () => (run ? generateEstimates(slug, run.seed, run.difficulty, data).slice(0, limit) : []),
    [slug, run, data, limit],
  );
  const max = questions.reduce((sum, question) => sum + maxPoints(question), 0);

  if (!run || !questions.length) {
    return (
      <GameStart game={game} withDifficulty={withDifficulty}>
        <p className="text-mist">{INTROS[slug][locale]}</p>
      </GameStart>
    );
  }
  if (finished) return <GameEnd game={game} data={data} max={max} withDifficulty={withDifficulty} />;

  const question = questions[index];
  // Un cran par chapitre ou par épisode : le barème se joue au numéro près
  const steps = question.scale === "linear" ? question.max - question.min : SLIDER_STEPS;
  const guess = typed.value ?? sliderToValue(question, position);
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
    setPosition(0.5);
    setTyped(NOT_TYPED);
  }

  function type(text: string) {
    const parsed = parseEstimate(text);
    const value = parsed === null ? null : Math.min(question.max, Math.max(question.min, parsed));
    setTyped({ text, value });
    if (value !== null) setPosition(valueToSlider(question, value));
  }

  return (
    <Panel className="space-y-4">
      <Progress current={index + 1} total={questions.length} score={t(`Score : ${score}`, `Score: ${score}`)} />
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
            {format(question, answered ? answers[index] : guess, locale)}
          </p>
          <label className="block">
            <span className="sr-only">{t("Ton estimation, au curseur", "Your estimate, with the slider")}</span>
            <input
              type="range"
              min={0}
              max={steps}
              step={1}
              value={Math.round(position * steps)}
              disabled={answered}
              onChange={(event) => {
                setPosition(Number(event.target.value) / steps);
                setTyped(NOT_TYPED);
              }}
              aria-valuetext={format(question, guess, locale)}
              className="w-full accent-straw"
            />
          </label>
          <div className="flex justify-between text-xs text-mist">
            <span>{format(question, question.min, locale)}</span>
            <span>{format(question, question.max, locale)}</span>
          </div>
        </div>

        {/* Deux blocs distincts (clés) : le bouton « Suivant » doit apparaître, et non remplacer « Valider », pour prendre la main */}
        {answered ? (
          <Correction
            key="correction"
            action={
              <Button autoFocus onClick={next}>
                {last ? t("Voir mon score", "See my score") : t("Suivant", "Next")}
              </Button>
            }
          >
            <p className="text-mist">
              <strong className={points >= maxPoints(question) * 0.6 ? "text-emerald-300" : points > 0 ? "text-straw" : "text-vest"}>
                {points > 0
                  ? t(`+${points} point${points > 1 ? "s" : ""}.`, `+${points} point${points === 1 ? "" : "s"}.`)
                  : t("Trop loin.", "Too far off.")}
              </strong>{" "}
              {t("La bonne réponse : ", "The correct answer: ")}
              {format(question, question.answer, locale)}.
            </p>
          </Correction>
        ) : (
          <div key="saisie" className="flex flex-wrap items-start gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t("Ton estimation, au clavier", "Your estimate, typed")}</span>
              <input
                type="text"
                inputMode={question.unit === "berrys" ? "text" : "numeric"}
                value={typed.text}
                onChange={(event) => type(event.target.value)}
                autoComplete="off"
                placeholder={
                  question.unit === "berrys"
                    ? t("Ou tape un montant : 320 M, 1,5 Md…", "Or type an amount: 320M, 1.5 billion, 56k…")
                    : t("Ou tape un numéro…", "Or type a number…")
                }
                aria-invalid={typed.text !== "" && typed.value === null}
                className="w-full rounded-lg border-2 border-sea-600 bg-sea-900 px-4 py-2.5 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none aria-invalid:border-vest"
              />
              <span className="mt-1 block min-h-5 text-sm text-vest" aria-live="polite">
                {typed.text !== "" && typed.value === null ? t("Ce n'est pas un nombre.", "That's not a number.") : ""}
              </span>
            </label>
            <Button type="submit">{t("Valider", "Submit")}</Button>
          </div>
        )}
      </form>
    </Panel>
  );
}
