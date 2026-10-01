"use client";

import Link from "next/link";
import { useState } from "react";
import { formatNumber } from "@/games/engine/text";
import { Button, Panel } from "@/games/ui/primitives";
import { LoadingPanel } from "@/games/ui/WithGameData";
import { deleteQuizAction, restoreQuizAction } from "@/lib/player/quiz-actions";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { useQuizList } from "@/lib/quiz/client";
import { QUIZ_LIMITS } from "@/lib/quiz/rules";
import { QUIZ_ERRORS, type QuizSummary } from "@/lib/quiz/types";

function QuizCard({ quiz, children }: { quiz: QuizSummary; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col rounded-xl border border-sea-700 bg-sea-800/70 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${quiz.spoiler === "manga" ? "bg-vest/20 text-vest" : "bg-sea-600 text-mist"}`}
        >
          {quiz.spoiler === "manga" ? "Spoilers manga" : "Sans spoiler anime"}
        </span>
        {quiz.status === "hidden" && <span className="rounded-full bg-vest px-2 py-0.5 text-xs font-bold text-white">Masqué</span>}
        {quiz.reports !== undefined && quiz.reports > 0 && (
          <span className="text-xs font-semibold text-mist">
            {quiz.reports} signalement{quiz.reports > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <h3 className="mt-2 text-lg font-bold text-foam">
        <Link href={`/quiz/${quiz.id}`} className="hover:text-straw hover:underline hover:underline-offset-4">
          {quiz.title}
        </Link>
      </h3>
      {quiz.description && <p className="mt-1 line-clamp-3 text-sm text-mist">{quiz.description}</p>}
      <p className="mt-2 text-sm text-mist">
        Par <strong className="text-foam">{quiz.author}</strong> · {quiz.questionCount} questions · joué{" "}
        {formatNumber(quiz.plays)} fois
      </p>
      {quiz.yourBest && (
        <p className="text-sm font-semibold text-emerald-300">
          Ton meilleur score : {quiz.yourBest.score} / {quiz.yourBest.max}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <Link href={`/quiz/${quiz.id}`} className="rounded-lg bg-straw px-4 py-2 font-bold text-ink hover:bg-straw-dark">
          {quiz.yourBest ? "Rejouer" : "Jouer"}
        </Link>
        {children}
      </div>
    </li>
  );
}

/** Bouton de suppression en deux temps : la suppression est définitive. */
function DeleteButton({ id, onDone }: { id: string; onDone: (error: string | null) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const result = await deleteQuizAction(id).catch(() => ({ ok: false, error: "unavailable" }) as const);
    setBusy(false);
    setConfirming(false);
    onDone(result.ok ? null : QUIZ_ERRORS[result.error]);
  }

  return confirming ? (
    <>
      <Button variant="secondary" onClick={remove} disabled={busy} className="border-vest text-vest">
        Confirmer la suppression
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
        Annuler
      </Button>
    </>
  ) : (
    <Button variant="ghost" onClick={() => setConfirming(true)}>
      Supprimer
    </Button>
  );
}

export function QuizHome() {
  const { status, accountsEnabled } = usePlayer();
  const [sort, setSort] = useState<"recent" | "top">("recent");
  const { list, reload } = useQuizList(sort);
  const [error, setError] = useState<string | null>(null);

  if (!list) return <LoadingPanel label="Chargement des quiz…" />;
  if (!list.enabled) {
    return (
      <Panel>
        <p className="text-mist">Les quiz de la communauté ne sont pas disponibles pour l&apos;instant.</p>
      </Panel>
    );
  }

  const done = (message: string | null) => {
    setError(message);
    reload();
  };

  async function restore(id: string) {
    const result = await restoreQuizAction(id).catch(() => ({ ok: false, error: "unavailable" }) as const);
    done(result.ok ? null : QUIZ_ERRORS[result.error]);
  }

  return (
    <div className="space-y-8">
      <Panel className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-3xl tracking-wide text-straw">Crée ton quiz</h2>
          <p className="text-mist">
            {QUIZ_LIMITS.questions.min} à {QUIZ_LIMITS.questions.max} questions, une bonne réponse et trois mauvaises
            pour chacune. Les autres joueurs y répondent en Duo, Carré ou Cash.
          </p>
        </div>
        {status === "user" ? (
          <Link href="/quiz/creer" className="rounded-lg bg-straw px-4 py-2.5 font-bold text-ink hover:bg-straw-dark">
            Créer un quiz
          </Link>
        ) : (
          accountsEnabled && (
            <Link href="/profil" className="rounded-lg border border-sea-600 bg-sea-700 px-4 py-2.5 font-bold text-foam hover:bg-sea-600">
              Se connecter pour créer un quiz
            </Link>
          )
        )}
      </Panel>

      {error && (
        <p role="alert" className="font-semibold text-vest">
          {error}
        </p>
      )}

      {list.isAdmin && list.hidden.length > 0 && (
        <section aria-labelledby="quiz-masques" className="space-y-3">
          <h2 id="quiz-masques" className="font-display text-3xl tracking-wide text-vest">
            Quiz masqués à relire · {list.hidden.length}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.hidden.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz}>
                <Button variant="secondary" onClick={() => restore(quiz.id)}>
                  Remettre en ligne
                </Button>
                <DeleteButton id={quiz.id} onDone={done} />
              </QuizCard>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="quiz-publics" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="quiz-publics" className="font-display text-3xl tracking-wide text-straw">
            Les quiz des joueurs
          </h2>
          <div className="flex gap-2" role="group" aria-label="Trier les quiz">
            {(["recent", "top"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={sort === value}
                onClick={() => setSort(value)}
                className={`rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${
                  sort === value ? "bg-straw text-ink" : "bg-sea-700 text-mist hover:text-foam"
                }`}
              >
                {value === "recent" ? "Les plus récents" : "Les plus joués"}
              </button>
            ))}
          </div>
        </div>
        {list.quizzes.length === 0 ? (
          <Panel>
            <p className="text-mist">Aucun quiz pour l&apos;instant. Le premier sera peut-être le tien.</p>
          </Panel>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.quizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz}>
                {list.isAdmin && <DeleteButton id={quiz.id} onDone={done} />}
              </QuizCard>
            ))}
          </ul>
        )}
      </section>

      {list.mine.length > 0 && (
        <section aria-labelledby="mes-quiz" className="space-y-3">
          <h2 id="mes-quiz" className="font-display text-3xl tracking-wide text-straw">
            Mes quiz · {list.mine.length} sur {QUIZ_LIMITS.perAuthor}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.mine.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz}>
                <DeleteButton id={quiz.id} onDone={done} />
              </QuizCard>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
