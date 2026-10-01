"use client";

import { useState } from "react";
import { Portrait } from "../ui/Portrait";
import { Button, Panel, Progress } from "../ui/primitives";
import type { Locale, Localized } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { DCC_KINDS, DCC_POINTS, isRight, type DccAnswer, type DccKind, type DccQuestion } from "./logic";

const KINDS: Record<DccKind, { label: Localized; detail: Localized }> = {
  duo: { label: { fr: "Duo", en: "Duo" }, detail: { fr: "Deux propositions", en: "Two choices" } },
  carre: { label: { fr: "Carré", en: "Quad" }, detail: { fr: "Quatre propositions", en: "Four choices" } },
  cash: {
    label: { fr: "Cash", en: "Cash" },
    detail: { fr: "Aucune proposition : tu écris la réponse", en: "No choices: you type the answer" },
  },
};

const points = (count: number, locale: Locale) =>
  locale === "en" ? `${count} point${count === 1 ? "" : "s"}` : `${count} point${count > 1 ? "s" : ""}`;

/**
 * Déroulé d'une série de questions en Duo, Carré ou Cash : choix du risque,
 * réponse, correction, question suivante.
 */
export function DccFlow({
  questions,
  onFinish,
}: {
  questions: DccQuestion[];
  onFinish: (score: number, answers: DccAnswer[]) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [kind, setKind] = useState<DccKind | null>(null);
  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<DccAnswer[]>([]);

  const question = questions[index];
  const given = answers.length > index ? answers[index] : null;
  const right = given ? isRight(question, given) : false;
  const last = index === questions.length - 1;
  const answerOption = question.options.find((option) => option.id === question.answerId);
  const shown =
    kind === "duo" ? question.options.filter((option) => question.duoIds.includes(option.id)) : kind === "carre" ? question.options : [];

  function answer(value: string) {
    if (!kind || given) return;
    const next = { kind, value };
    setAnswers([...answers, next]);
    if (isRight(question, next)) setScore(score + DCC_POINTS[kind]);
  }

  function next() {
    if (last) {
      onFinish(score, answers);
      return;
    }
    setIndex(index + 1);
    setKind(null);
    setInput("");
  }

  return (
    <Panel className="space-y-4">
      <Progress current={index + 1} total={questions.length} score={t(`Score : ${score}`, `Score: ${score}`)} />
      <div className="space-y-2 text-center">
        <p className="text-mist">{question.title}</p>
        {question.img && <Portrait img={question.img} />}
        <p className={question.subject.length > 60 ? "text-xl font-bold text-foam" : "font-display text-3xl tracking-wide text-straw"}>
          {question.subject}
        </p>
        {question.detail && <p className="text-mist">{question.detail}</p>}
      </div>

      {kind === null && (
        <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label={t("Choisis ton risque", "Pick your risk")}>
          {DCC_KINDS.map((option, i) => (
            <button
              key={option}
              type="button"
              autoFocus={i === 0}
              onClick={() => setKind(option)}
              className="rounded-xl border-2 border-sea-600 bg-sea-700 px-4 py-3 text-left transition-colors hover:border-straw"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-display text-2xl tracking-wide text-straw">{KINDS[option].label[locale]}</span>
                <span className="text-sm font-bold text-foam">{points(DCC_POINTS[option], locale)}</span>
              </span>
              <span className="block text-sm text-mist">{KINDS[option].detail[locale]}</span>
            </button>
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {shown.map((option) => {
            const isAnswer = option.id === question.answerId;
            const isChosen = given?.value === option.id;
            const tone = !given
              ? "border-sea-600 bg-sea-700 hover:border-straw"
              : isAnswer
                ? "border-emerald-400 bg-emerald-600/30"
                : isChosen
                  ? "border-vest bg-vest/30"
                  : "border-sea-700 bg-sea-800 opacity-60";
            return (
              <button
                key={option.id}
                type="button"
                disabled={!!given}
                onClick={() => answer(option.id)}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${tone}`}
              >
                {option.img && <Portrait img={option.img} className="h-20 w-16 shrink-0" />}
                <span className="min-w-0">
                  <span className="block font-bold text-foam">
                    {given && isAnswer ? "✓ " : given && isChosen ? "✗ " : ""}
                    {option.label}
                  </span>
                  {option.detail && <span className="block text-sm text-mist">{option.detail}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {kind === "cash" && !given && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (input.trim()) answer(input);
          }}
        >
          <label htmlFor="cash-saisie" className="sr-only">
            {t("Ta réponse", "Your answer")}
          </label>
          <input
            id="cash-saisie"
            type="text"
            autoFocus
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={120}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={t("Ta réponse…", "Your answer…")}
            className="min-w-0 flex-1 rounded-lg border-2 border-sea-600 bg-sea-900 px-4 py-3 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none"
          />
          <Button type="submit" disabled={!input.trim()}>
            {t("Valider", "Submit")}
          </Button>
          <Button variant="secondary" onClick={() => answer("")}>
            {t("Je ne sais pas", "I don't know")}
          </Button>
        </form>
      )}

      {given && (
        <div className="space-y-3" aria-live="polite">
          {/* En cash, ou quand la question n'a pas d'image, le portrait de la bonne réponse vient avec la correction */}
          {answerOption?.img && (kind === "cash" || !question.img) && <Portrait img={answerOption.img} />}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-mist">
              <strong className={right ? "text-emerald-300" : "text-vest"}>
                {right
                  ? t(
                      `Bonne réponse : +${points(DCC_POINTS[given.kind], locale)}.`,
                      `Correct: +${points(DCC_POINTS[given.kind], locale)}.`,
                    )
                  : t("Raté.", "Wrong.")}
              </strong>{" "}
              {given.kind === "cash" &&
                given.value.trim() &&
                !right &&
                t(`Tu as répondu « ${given.value.trim()} ». `, `You answered “${given.value.trim()}”. `)}
              {question.explanation}
            </p>
            <Button autoFocus onClick={next}>
              {last ? t("Voir mon score", "See my score") : t("Suivant", "Next")}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
