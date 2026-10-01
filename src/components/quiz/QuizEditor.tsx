"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckIcon } from "@/components/GameBadge";
import { DCC_POINTS } from "@/games/duo-carre-cash/logic";
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
  "h-12 w-full rounded-[10px] border border-sea-600 bg-sea-900 px-3.5 text-foam placeholder:text-mist/60 focus:border-straw focus:outline-none";
const LABEL = "mb-1.5 block text-sm font-bold text-foam";

/** Une question est prête quand elle a son énoncé, sa bonne réponse et ses trois fausses. */
const isComplete = (question: QuizDraft["questions"][number]) =>
  question.prompt.trim().length >= QUIZ_LIMITS.prompt.min && !!question.answer.trim() && question.wrong.every((wrong) => wrong.trim());

/** Formulaire de création d'un quiz. Le brouillon est gardé dans le navigateur tant qu'il n'est pas publié. */
export function QuizEditor() {
  const router = useRouter();
  const { status, accountsEnabled } = usePlayer();
  const [draft, setDraft] = useStored<QuizDraft>("opm.quiz.draft", EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [current, setCurrent] = useState(0);

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

  // Une question retirée ailleurs peut laisser la sélection au-delà de la liste
  const index = Math.min(current, draft.questions.length - 1);
  const question = draft.questions[index];
  const ready = draft.questions.filter(isComplete).length;
  const { min, max } = QUIZ_LIMITS.questions;

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

  function addQuestion() {
    setDraft({ ...draft, questions: [...draft.questions, emptyQuestion()] });
    setCurrent(draft.questions.length);
  }

  function removeQuestion() {
    setDraft({ ...draft, questions: draft.questions.filter((_, i) => i !== index) });
    setCurrent(Math.max(0, index - 1));
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        publish();
      }}
    >
      <div className="grid items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="space-y-3.5 rounded-2xl border border-sea-700 bg-sea-800 p-4">
            <label className="block">
              <span className={LABEL}>Titre</span>
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
              <span className={LABEL}>
                En une phrase <span className="font-normal text-mist">(facultatif)</span>
              </span>
              <textarea
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                maxLength={QUIZ_LIMITS.description}
                rows={2}
                placeholder="De quoi parle ton quiz, et pour qui."
                className={`${FIELD} h-auto py-2.5`}
              />
            </label>
            <fieldset>
              <legend className={LABEL}>Pour jouer sans être spoilé, il faut suivre</legend>
              <div className="grid grid-cols-2 rounded-xl bg-sea-900 p-1">
                {(["anime", "manga"] as const).map((value) => (
                  <label
                    key={value}
                    className={`flex min-h-11 cursor-pointer items-center justify-center rounded-[9px] text-[15px] font-extrabold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-straw ${
                      draft.spoiler === value ? "bg-straw text-ink" : "text-mist hover:text-foam"
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
              <p className="mt-2 text-[13px] text-mist">
                {draft.spoiler === "anime"
                  ? "Aucune question ne doit porter sur des chapitres pas encore adaptés en anime."
                  : "Les joueurs qui ne suivent que l'anime seront prévenus avant de jouer."}
              </p>
            </fieldset>
          </div>

          <div className="space-y-1.5 rounded-2xl border border-sea-700 p-3">
            <h2 className="px-1.5 py-1 text-xs font-extrabold tracking-[0.15em] text-mist uppercase">
              Questions · {draft.questions.length} sur {max} au plus
            </h2>
            <ol className="space-y-1">
              {draft.questions.map((q, i) => {
                const complete = isComplete(q);
                const selected = i === index;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setCurrent(i)}
                      className={`flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 text-left text-sm transition-colors ${
                        selected ? "border-2 border-straw bg-sea-800 font-extrabold text-foam" : "border-2 border-transparent text-foam hover:bg-sea-800"
                      }`}
                    >
                      <span className={`w-5 shrink-0 font-extrabold ${selected ? "text-straw" : "text-[#6f8fb0]"}`}>{i + 1}</span>
                      <span className={`min-w-0 flex-1 truncate ${q.prompt.trim() ? "" : "text-mist"}`}>{q.prompt.trim() || "Question sans énoncé"}</span>
                      {complete ? (
                        <CheckIcon className="size-3.5 shrink-0 text-emerald-300" />
                      ) : (
                        <span className="shrink-0 text-xs font-extrabold text-[#f5a88a]">à finir</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
            {draft.questions.length < max && (
              <button
                type="button"
                onClick={addQuestion}
                className="min-h-11 w-full cursor-pointer rounded-[10px] border border-dashed border-sea-600 text-sm font-extrabold text-foam transition-colors hover:border-straw"
              >
                Ajouter une question
              </button>
            )}
          </div>
        </aside>

        <section aria-labelledby="question-courante" className="space-y-4 rounded-[20px] border border-sea-700 bg-sea-800 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="question-courante" className="text-xl font-extrabold text-foam">
              Question {index + 1}
            </h2>
            {draft.questions.length > 1 && (
              <button type="button" onClick={removeQuestion} className="min-h-11 cursor-pointer px-2 text-sm font-bold text-[#f5a88a] hover:underline">
                Supprimer la question
              </button>
            )}
          </div>
          <label className="block">
            <span className={LABEL}>Énoncé</span>
            <textarea
              value={question.prompt}
              onChange={(event) => setQuestion(index, { prompt: event.target.value })}
              maxLength={QUIZ_LIMITS.prompt.max}
              rows={2}
              placeholder="Quel sabre Zoro reçoit-il à Wano ?"
              className={`${FIELD} h-auto py-2.5`}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={`${LABEL} text-emerald-300`}>Bonne réponse</span>
              <input
                type="text"
                value={question.answer}
                onChange={(event) => setQuestion(index, { answer: event.target.value })}
                maxLength={QUIZ_LIMITS.answer}
                className={`${FIELD} border-2 border-emerald-500/70 bg-emerald-600/10`}
              />
            </label>
            {question.wrong.map((wrong, w) => (
              <label key={w} className="block">
                <span className={LABEL}>{w === 0 ? "Fausse réponse du Duo" : "Fausse réponse du Carré"}</span>
                <input
                  type="text"
                  value={wrong}
                  onChange={(event) => setQuestion(index, { wrong: question.wrong.map((value, i) => (i === w ? event.target.value : value)) })}
                  maxLength={QUIZ_LIMITS.answer}
                  className={FIELD}
                />
              </label>
            ))}
          </div>
          <label className="block">
            <span className={LABEL}>
              Autres écritures acceptées en Cash <span className="font-normal text-mist">(facultatif)</span>
            </span>
            <input
              type="text"
              value={question.alternatives}
              onChange={(event) => setQuestion(index, { alternatives: event.target.value })}
              placeholder="Enma ; Emma"
              className={FIELD}
            />
            <span className="mt-1.5 block text-[13px] text-mist">
              Séparées par un point-virgule. Majuscules, accents et petites fautes de frappe sont déjà tolérés.
            </span>
          </label>

          <div className="space-y-2.5 rounded-[14px] border border-sea-700 px-4 py-3.5">
            <h3 className="text-xs font-extrabold tracking-[0.15em] text-mist uppercase">Ce que verra le joueur</h3>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="font-extrabold text-[#8fd0f0]">Duo · {DCC_POINTS.duo} pt</dt>
                <dd className="text-mist">{[question.answer, question.wrong[0]].map((v) => v.trim() || "…").join(" ou ")}</dd>
              </div>
              <div>
                <dt className="font-extrabold text-violet-300">Carré · {DCC_POINTS.carre} pts</dt>
                <dd className="text-mist">{[question.answer, ...question.wrong].map((v) => v.trim() || "…").join(", ")}</dd>
              </div>
              <div>
                <dt className="font-extrabold text-straw">Cash · {DCC_POINTS.cash} pts</dt>
                <dd className="text-mist">Un champ vide à remplir</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

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

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-sea-700 bg-sea-800 px-5 py-4">
        <div className="w-full space-y-1.5 sm:w-72">
          <p className="flex justify-between gap-3 text-[13px] font-bold">
            <span>
              {ready} question{ready > 1 ? "s" : ""} prête{ready > 1 ? "s" : ""} sur {min} au minimum
            </span>
            <span className="text-mist">{max} max</span>
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-sea-700">
            <div className={`h-full ${ready >= min ? "bg-emerald-300" : "bg-straw"}`} style={{ width: `${Math.min(1, ready / min) * 100}%` }} />
          </div>
        </div>
        <p className="min-w-0 flex-1 text-sm text-mist">
          Visible de tous, sous ton pseudo. Pas d&apos;insultes ni de spoilers au-delà de ce que tu as indiqué : un quiz signalé par{" "}
          {REPORTS_TO_HIDE} joueurs est masqué. Ton brouillon est gardé dans ce navigateur.
        </p>
        <Button type="submit" disabled={busy} className="min-h-12 px-6">
          {busy ? "Publication…" : "Publier le quiz"}
        </Button>
      </div>
    </form>
  );
}
