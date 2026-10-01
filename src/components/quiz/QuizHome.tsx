"use client";

import Link from "@/components/Link";
import { useState } from "react";
import { CheckIcon } from "@/components/GameBadge";
import { DCC_POINTS } from "@/games/duo-carre-cash/logic";
import { formatNumber } from "@/games/engine/text";
import { Button, Panel } from "@/games/ui/primitives";
import { LoadingPanel } from "@/games/ui/WithGameData";
import { useLocale, useT } from "@/lib/i18n/client";
import { deleteQuizAction, restoreQuizAction } from "@/lib/player/quiz-actions";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { useQuizList } from "@/lib/quiz/client";
import { COMMUNITY_BERRYS, QUIZ_LIMITS, REPORTS_TO_HIDE } from "@/lib/quiz/rules";
import { QUIZ_ERRORS, type QuizSummary } from "@/lib/quiz/types";

function QuizCard({ quiz, mine = false, children }: { quiz: QuizSummary; mine?: boolean; children?: React.ReactNode }) {
  const t = useT();
  const locale = useLocale();
  return (
    <li className={`flex flex-col gap-2.5 rounded-2xl border border-sea-700 p-4 ${quiz.yourBest || mine ? "" : "bg-sea-800"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg leading-snug font-extrabold text-foam">
          <Link href={`/quiz/${quiz.id}`} className="hover:text-straw">
            {quiz.title}
          </Link>
        </h3>
        {mine ? (
          <span className="shrink-0 rounded-full bg-sea-700 px-2.5 py-0.5 text-[13px] font-extrabold text-mist">
            {t("Le tien", "Yours")}
          </span>
        ) : quiz.yourBest ? (
          <span className="flex shrink-0 items-center gap-1 text-sm font-extrabold text-emerald-300">
            <CheckIcon className="size-3.5" />
            {quiz.yourBest.score} / {quiz.yourBest.max}
          </span>
        ) : (
          <span className="shrink-0 text-sm font-extrabold text-straw">
            {t("jusqu'à", "up to")} {COMMUNITY_BERRYS} ฿
          </span>
        )}
      </div>
      {quiz.description && <p className="line-clamp-3 text-sm text-mist">{quiz.description}</p>}
      {(quiz.spoiler === "manga" || quiz.status === "hidden" || !!quiz.reports) && (
        <p className="flex flex-wrap items-center gap-2 text-xs font-bold">
          {quiz.spoiler === "manga" && (
            <span className="rounded-full bg-vest/20 px-2 py-0.5 text-vest">{t("Spoilers manga", "Manga spoilers")}</span>
          )}
          {quiz.status === "hidden" && (
            <span className="rounded-full bg-vest px-2 py-0.5 text-white">{t("Masqué", "Hidden")}</span>
          )}
          {!!quiz.reports && (
            <span className="text-mist">
              {quiz.reports} {t(`signalement${quiz.reports > 1 ? "s" : ""}`, quiz.reports === 1 ? "report" : "reports")}
            </span>
          )}
        </p>
      )}
      <p className="mt-auto flex flex-wrap justify-between gap-x-3 pt-1 text-[13px] text-mist">
        <span>
          {t("par", "by")} {mine ? t("toi", "you") : quiz.author} · {quiz.questionCount} questions
        </span>
        <span>
          {formatNumber(quiz.plays, locale)}{" "}
          {t(`partie${quiz.plays > 1 ? "s" : ""}`, quiz.plays === 1 ? "play" : "plays")}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/quiz/${quiz.id}`}
          className={`flex min-h-11 items-center rounded-[10px] px-4 text-sm font-extrabold transition-colors ${
            quiz.yourBest || mine ? "border border-sea-600 text-foam hover:border-straw" : "bg-straw text-ink hover:bg-straw-dark"
          }`}
        >
          {quiz.yourBest ? t("Rejouer", "Play again") : mine ? t("Voir", "View") : t("Jouer", "Play")}
        </Link>
        {children}
      </div>
    </li>
  );
}

/** Bouton de suppression en deux temps : la suppression est définitive. */
function DeleteButton({ id, onDone }: { id: string; onDone: (error: string | null) => void }) {
  const t = useT();
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const result = await deleteQuizAction(id).catch(() => ({ ok: false, error: "unavailable" }) as const);
    setBusy(false);
    setConfirming(false);
    onDone(result.ok ? null : QUIZ_ERRORS[locale][result.error]);
  }

  return confirming ? (
    <>
      <Button variant="secondary" onClick={remove} disabled={busy} className="border-vest text-vest">
        {t("Confirmer la suppression", "Confirm deletion")}
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
        {t("Annuler", "Cancel")}
      </Button>
    </>
  ) : (
    <Button variant="ghost" onClick={() => setConfirming(true)}>
      {t("Supprimer", "Delete")}
    </Button>
  );
}

export function QuizHome() {
  const t = useT();
  const locale = useLocale();
  const { status, accountsEnabled } = usePlayer();
  const [sort, setSort] = useState<"recent" | "top">("recent");
  const { list, reload } = useQuizList(sort);
  const [error, setError] = useState<string | null>(null);

  if (!list) return <LoadingPanel label={t("Chargement des quiz…", "Loading quizzes…")} />;
  if (!list.enabled) {
    return (
      <Panel>
        <p className="text-mist">
          {t(
            "Les quiz de la communauté ne sont pas disponibles pour l'instant.",
            "Community quizzes aren't available right now.",
          )}
        </p>
      </Panel>
    );
  }

  const done = (message: string | null) => {
    setError(message);
    reload();
  };

  async function restore(id: string) {
    const result = await restoreQuizAction(id).catch(() => ({ ok: false, error: "unavailable" }) as const);
    done(result.ok ? null : QUIZ_ERRORS[locale][result.error]);
  }

  const kinds = [
    { name: "Duo", points: DCC_POINTS.duo, detail: t("Deux propositions", "Two choices"), tone: "text-[#8fd0f0]" },
    {
      name: t("Carré", "Quad"),
      points: DCC_POINTS.carre,
      detail: t("Quatre propositions", "Four choices"),
      tone: "text-violet-300",
    },
    {
      name: "Cash",
      points: DCC_POINTS.cash,
      detail: t("Tu tapes la réponse, sans aide", "You type the answer, with no help"),
      tone: "text-straw",
    },
  ];
  const create =
    status === "user" ? (
      <Link href="/quiz/creer" className="flex min-h-12 items-center gap-2 rounded-xl bg-straw px-5 font-extrabold text-ink hover:bg-straw-dark sm:ml-auto">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" className="size-[18px]">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {t("Créer un quiz", "Create a quiz")}
      </Link>
    ) : accountsEnabled ? (
      <Link href="/profil" className="flex min-h-12 items-center rounded-xl border border-straw px-5 font-extrabold text-straw hover:bg-straw/10 sm:ml-auto">
        {t("Se connecter pour créer un quiz", "Log in to create a quiz")}
      </Link>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="grid items-center gap-x-5 gap-y-3 rounded-2xl border border-sea-700 px-5 py-4 sm:grid-cols-[auto_repeat(3,minmax(0,1fr))]">
        <p className="text-xs font-extrabold tracking-[0.15em] text-mist uppercase">
          {t("À chaque question,", "On every question,")}
          <br className="hidden sm:block" /> {t("tu choisis ta mise", "you pick your stake")}
        </p>
        {kinds.map((kind) => (
          <p key={kind.name} className="flex items-center gap-3">
            <span className={`w-14 shrink-0 font-display text-[26px] tracking-wide ${kind.tone}`}>
              {kind.points} pt{kind.points > 1 ? "s" : ""}
            </span>
            <span>
              <span className="block font-extrabold text-foam">{kind.name}</span>
              <span className="block text-sm text-mist">{kind.detail}</span>
            </span>
          </p>
        ))}
      </div>

      {error && (
        <p role="alert" className="font-semibold text-vest">
          {error}
        </p>
      )}

      {list.isAdmin && list.hidden.length > 0 && (
        <section aria-labelledby="quiz-masques" className="space-y-3">
          <h2 id="quiz-masques" className="text-xl font-extrabold text-vest">
            {t("Quiz masqués à relire", "Hidden quizzes to review")} · {list.hidden.length}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.hidden.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz}>
                <Button variant="secondary" onClick={() => restore(quiz.id)} className="min-h-11 py-0 text-sm">
                  {t("Remettre en ligne", "Put back online")}
                </Button>
                <DeleteButton id={quiz.id} onDone={done} />
              </QuizCard>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="quiz-publics" className="space-y-4">
        <h2 id="quiz-publics" className="sr-only">
          {t("Les quiz des joueurs", "Players' quizzes")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2" role="group" aria-label={t("Trier les quiz", "Sort quizzes")}>
            {(["recent", "top"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={sort === value}
                onClick={() => setSort(value)}
                className={`min-h-11 cursor-pointer rounded-full px-4 text-sm font-bold transition-colors ${
                  sort === value ? "bg-straw text-ink" : "border border-sea-700 text-mist hover:text-foam"
                }`}
              >
                {value === "recent" ? t("Récents", "Recent") : t("Les plus joués", "Most played")}
              </button>
            ))}
          </div>
          {list.mine.length > 0 && (
            <a href="#mes-quiz" className="flex min-h-11 items-center rounded-full border border-sea-700 px-4 text-sm font-bold text-mist hover:text-foam">
              {t("Les miens", "Mine")} · {list.mine.length}
            </a>
          )}
          {create}
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.quizzes.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz}>
              {list.isAdmin && <DeleteButton id={quiz.id} onDone={done} />}
            </QuizCard>
          ))}
          {status === "user" && (
            <li>
              <Link
                href="/quiz/creer"
                className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sea-600 p-4 text-center text-mist transition-colors hover:border-straw"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="size-6">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="font-extrabold text-foam">
                  {list.quizzes.length === 0 ? t("Écris le premier", "Write the first one") : t("Écris le tien", "Write your own")}
                </span>
                <span className="text-sm">
                  {t(
                    `De ${QUIZ_LIMITS.questions.min} à ${QUIZ_LIMITS.questions.max} questions, publié tout de suite`,
                    `${QUIZ_LIMITS.questions.min} to ${QUIZ_LIMITS.questions.max} questions, published right away`,
                  )}
                </span>
              </Link>
            </li>
          )}
        </ul>
        {list.quizzes.length === 0 && status !== "user" && (
          <Panel>
            <p className="text-mist">
              {t(
                "Aucun quiz pour l'instant. Le premier sera peut-être le tien.",
                "No quizzes yet. The first one might be yours.",
              )}
            </p>
          </Panel>
        )}
      </section>

      {list.mine.length > 0 && (
        <section aria-labelledby="mes-quiz" className="scroll-mt-6 space-y-3">
          <h2 id="mes-quiz" className="text-xl font-extrabold text-foam">
            {t("Mes quiz", "My quizzes")}{" "}
            <span className="text-base font-semibold text-mist">
              · {list.mine.length} {t("sur", "of")} {QUIZ_LIMITS.perAuthor}
            </span>
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.mine.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} mine>
                <DeleteButton id={quiz.id} onDone={done} />
              </QuizCard>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-mist">
        {t(
          `Un quiz faux ou déplacé ? Chaque quiz a un bouton « Signaler » sur sa page. À ${REPORTS_TO_HIDE} signalements, il est masqué en attendant une vérification.`,
          `A quiz that's wrong or out of line? Every quiz has a “Report” button on its page. At ${REPORTS_TO_HIDE} reports, it's hidden until it has been checked.`,
        )}
      </p>
    </div>
  );
}
