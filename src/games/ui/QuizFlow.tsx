"use client";

import { useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { Portrait } from "./Portrait";
import { Button, Correction, Panel, Progress } from "./primitives";

export type QuizQuestion = {
  id: string;
  prompt: ReactNode;
  /** `img` : portrait affiché dans la proposition (fichier dans /images/portraits). */
  options: { id: string; label: string; detail?: string; img?: string | null }[];
  answerId: string;
  /** Complément affiché une fois la réponse donnée. */
  explanation?: ReactNode;
};

/** Déroulé commun des quiz à choix : question, réponse, correction, question suivante. */
export function QuizFlow({
  questions,
  columns = 2,
  onFinish,
}: {
  questions: QuizQuestion[];
  columns?: 2 | 3;
  onFinish: (score: number, answers: string[]) => void;
}) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);

  const question = questions[index];
  const answered = chosen !== null;
  const last = index === questions.length - 1;

  function answer(optionId: string) {
    if (answered) return;
    setChosen(optionId);
    setAnswers([...answers, optionId]);
    if (optionId === question.answerId) setScore(score + 1);
  }

  function next() {
    if (last) {
      onFinish(score, answers);
      return;
    }
    setIndex(index + 1);
    setChosen(null);
  }

  return (
    <Panel className="space-y-4">
      <Progress current={index + 1} total={questions.length} score={t(`Score : ${score}`, `Score: ${score}`)} />
      <div>{question.prompt}</div>
      <div className={`grid gap-2 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {question.options.map((option) => {
          const isAnswer = option.id === question.answerId;
          const state = !answered
            ? "border-sea-600 bg-sea-700 hover:border-straw"
            : isAnswer
              ? "border-emerald-400 bg-emerald-600/30"
              : option.id === chosen
                ? "border-vest bg-vest/30"
                : "border-sea-700 bg-sea-800 opacity-60";
          return (
            <button
              key={option.id}
              type="button"
              disabled={answered}
              onClick={() => answer(option.id)}
              className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${state}`}
            >
              {option.img && <Portrait img={option.img} className="h-20 w-16 shrink-0" />}
              <span className="min-w-0">
                <span className="block font-bold text-foam">
                  {answered && isAnswer ? "✓ " : answered && option.id === chosen ? "✗ " : ""}
                  {option.label}
                </span>
                {option.detail && <span className="block text-sm text-mist">{option.detail}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {answered && (
        <Correction
          action={
            <Button autoFocus onClick={next}>
              {last ? t("Voir mon score", "See my score") : t("Suivant", "Next")}
            </Button>
          }
        >
          <p className="text-mist">
            <strong className={chosen === question.answerId ? "text-emerald-300" : "text-vest"}>
              {chosen === question.answerId ? t("Bonne réponse.", "Correct.") : t("Raté.", "Wrong.")}
            </strong>{" "}
            {question.explanation}
          </p>
        </Correction>
      )}
    </Panel>
  );
}
