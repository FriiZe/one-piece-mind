"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Panel } from "@/games/ui/primitives";
import { useStored } from "@/games/ui/storage";
import { LoadingPanel } from "@/games/ui/WithGameData";
import { createQuizAction } from "@/lib/player/quiz-actions";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { draftProblems, draftToInput, QUIZ_LIMITS, REPORTS_TO_HIDE, type QuizDraft } from "@/lib/quiz/rules";
import { QUIZ_ERRORS } from "@/lib/quiz/types";

const emptyQuestion = () => ({ prompt: "", answer: "", wrong: ["", "", ""], alternatives: "" });
const EMPTY_DRAFT: QuizDraft = {
  title: "",
  description: "",
  spoiler: "anime",
  questions: Array.from({ length: QUIZ_LIMITS.questions.min }, emptyQuestion),
};

const FIELD =
  "w-full rounded-lg border-2 border-sea-600 bg-sea-900 px-3 py-2 text-foam placeholder:text-mist/60 focus:border-straw focus:outline-none";

/** Formulaire de création d'un quiz. Le brouillon est gardé dans le navigateur tant qu'il n'est pas publié. */
export function QuizEditor() {
  const router = useRouter();
  const { status, accountsEnabled } = usePlayer();
  const [draft, setDraft] = useStored<QuizDraft>("opm.quiz.draft", EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  if (status === "loading") return <LoadingPanel />;
  if (status !== "user") {
    return (
      <Panel className="space-y-3">
        <p className="text-mist">
          {accountsEnabled
            ? "Il faut un compte pour créer un quiz : il porte ton pseudo, et tu peux le supprimer quand tu veux."
            : "La création de quiz n'est pas disponible pour l'instant."}
        </p>
        {accountsEnabled && (
          <Link href="/profil" className="inline-block rounded-lg bg-straw px-4 py-2.5 font-bold text-ink hover:bg-straw-dark">
            Se connecter ou créer un compte
          </Link>
        )}
      </Panel>
    );
  }

  const problems = draftProblems(draft);
  const setQuestion = (index: number, change: Partial<QuizDraft["questions"][number]>) =>
    setDraft({ ...draft, questions: draft.questions.map((question, i) => (i === index ? { ...question, ...change } : question)) });

  async function publish() {
    setChecked(true);
    setError(null);
    if (problems.length) return;
    setBusy(true);
    const result = await createQuizAction(draftToInput(draft)).catch(() => ({ ok: false, error: "unavailable" }) as const);
    setBusy(false);
    if (!result.ok) {
      setError(QUIZ_ERRORS[result.error]);
      return;
    }
    setDraft(EMPTY_DRAFT);
    router.push(`/quiz/${result.id}`);
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        publish();
      }}
    >
      <Panel className="space-y-4">
        <label className="block">
          <span className="mb-1 block font-bold text-foam">Titre du quiz</span>
          <input
            type="text"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            maxLength={QUIZ_LIMITS.title.max}
            placeholder="Les sabres de Wano"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-bold text-foam">
            Description <span className="font-normal text-mist">(facultative)</span>
          </span>
          <textarea
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            maxLength={QUIZ_LIMITS.description}
            rows={2}
            placeholder="De quoi parle ton quiz, et pour qui."
            className={FIELD}
          />
        </label>
        <fieldset>
          <legend className="mb-2 font-bold text-foam">Pour jouer sans être spoilé, il faut être à jour sur</legend>
          <div className="flex flex-wrap gap-2">
            {(["anime", "manga"] as const).map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded-full border-2 px-4 py-1.5 font-bold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-straw ${
                  draft.spoiler === value ? "border-straw bg-straw text-ink" : "border-sea-600 text-mist hover:text-foam"
                }`}
              >
                <input
                  type="radio"
                  name="spoiler"
                  value={value}
                  checked={draft.spoiler === value}
                  onChange={() => setDraft({ ...draft, spoiler: value })}
                  className="sr-only"
                />
                {value === "anime" ? "l'anime" : "le manga"}
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-mist">
            {draft.spoiler === "anime"
              ? "Aucune question ne doit porter sur des chapitres pas encore adaptés en anime."
              : "Les joueurs qui ne suivent que l'anime seront prévenus avant de jouer."}
          </p>
        </fieldset>
      </Panel>

      <ol className="space-y-4">
        {draft.questions.map((question, index) => (
          <li key={index}>
            <Panel className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl tracking-wide text-straw">Question {index + 1}</h2>
                {draft.questions.length > 1 && (
                  <Button
                    variant="ghost"
                    onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, i) => i !== index) })}
                    aria-label={`Retirer la question ${index + 1}`}
                  >
                    Retirer
                  </Button>
                )}
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-mist">Énoncé</span>
                <textarea
                  value={question.prompt}
                  onChange={(event) => setQuestion(index, { prompt: event.target.value })}
                  maxLength={QUIZ_LIMITS.prompt.max}
                  rows={2}
                  placeholder="Quel sabre Zoro reçoit-il à Wano ?"
                  className={FIELD}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-emerald-300">Bonne réponse</span>
                  <input
                    type="text"
                    value={question.answer}
                    onChange={(event) => setQuestion(index, { answer: event.target.value })}
                    maxLength={QUIZ_LIMITS.answer}
                    className={`${FIELD} border-emerald-600`}
                  />
                </label>
                {question.wrong.map((wrong, w) => (
                  <label key={w} className="block">
                    <span className="mb-1 block text-sm font-semibold text-mist">
                      Mauvaise réponse {w + 1}
                      {w === 0 && " (proposée aussi en Duo)"}
                    </span>
                    <input
                      type="text"
                      value={wrong}
                      onChange={(event) =>
                        setQuestion(index, { wrong: question.wrong.map((value, i) => (i === w ? event.target.value : value)) })
                      }
                      maxLength={QUIZ_LIMITS.answer}
                      className={FIELD}
                    />
                  </label>
                ))}
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-mist">
                  Autres graphies acceptées en Cash <span className="font-normal">(facultatif, séparées par un point-virgule)</span>
                </span>
                <input
                  type="text"
                  value={question.alternatives}
                  onChange={(event) => setQuestion(index, { alternatives: event.target.value })}
                  placeholder="Enma ; Emma"
                  className={FIELD}
                />
              </label>
            </Panel>
          </li>
        ))}
      </ol>

      {draft.questions.length < QUIZ_LIMITS.questions.max && (
        <Button variant="secondary" onClick={() => setDraft({ ...draft, questions: [...draft.questions, emptyQuestion()] })}>
          Ajouter une question
        </Button>
      )}

      <Panel className="space-y-3">
        <p className="text-sm text-mist">
          Ton quiz sera visible de tous, sous ton pseudo. Pas d&apos;insultes, pas de spoilers au-delà de ce que tu as
          indiqué : un quiz signalé par {REPORTS_TO_HIDE} joueurs est masqué. Les majuscules, les accents et une petite
          faute de frappe sont tolérés dans les réponses en Cash.
        </p>
        {checked && problems.length > 0 && (
          <ul role="alert" className="list-inside list-disc space-y-0.5 text-sm font-semibold text-vest">
            {problems.slice(0, 8).map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
            {problems.length > 8 && <li>… et {problems.length - 8} autres points à corriger.</li>}
          </ul>
        )}
        {error && (
          <p role="alert" className="font-semibold text-vest">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            Publier le quiz
          </Button>
          <Link href="/quiz" className="text-sm font-semibold text-mist underline underline-offset-4 hover:text-foam">
            Revenir aux quiz
          </Link>
          <span className="text-sm text-mist">Ton brouillon est gardé dans ce navigateur.</span>
        </div>
      </Panel>
    </form>
  );
}
