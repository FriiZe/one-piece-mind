"use client";

import Link from "@/components/Link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DccFlow } from "@/games/duo-carre-cash/DccFlow";
import type { DccAnswer } from "@/games/duo-carre-cash/logic";
import { randomSeed } from "@/games/engine/rng";
import { formatNumber } from "@/games/engine/text";
import { Button, Panel, ResultPanel, ShareButton } from "@/games/ui/primitives";
import { useStored } from "@/games/ui/storage";
import { LoadingPanel } from "@/games/ui/WithGameData";
import { getGame } from "@/lib/games/catalog";
import type { Localized } from "@/lib/i18n";
import { useLocale, useLocalePath, useT } from "@/lib/i18n/client";
import { deleteQuizAction, reportQuizAction, restoreQuizAction, submitQuizAction } from "@/lib/player/quiz-actions";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { useQuiz } from "@/lib/quiz/client";
import { COMMUNITY_BERRYS, scoreQuiz, toDccQuestions } from "@/lib/quiz/rules";
import { QUIZ_ERRORS, type QuizDetail, type QuizError, type QuizPlayResult } from "@/lib/quiz/types";
import type { SpoilerMode } from "@/lib/spoilers";

type Finished = { score: number; max: number; server: QuizPlayResult | "pending" | "failed" | null };

const REWARD_NOTES: Record<Exclude<QuizPlayResult["reward"], "paid">, Localized> = {
  already: {
    fr: "Tu avais déjà terminé ce quiz : il ne rapporte des Berrys que la première fois.",
    en: "You had already finished this quiz: it only earns Berries the first time.",
  },
  own: {
    fr: "C'est ton quiz : il ne te rapporte pas de Berrys.",
    en: "It's your quiz: it doesn't earn you any Berries.",
  },
  limit: {
    fr: "Tu as déjà été récompensé pour beaucoup de quiz aujourd'hui : pas de Berrys pour celui-ci.",
    en: "You've already been rewarded for a lot of quizzes today: no Berries for this one.",
  },
};

/** Signalement, suppression, remise en ligne : ce qu'on peut faire d'un quiz en dehors d'y jouer. */
function Moderation({ quiz, onChanged }: { quiz: QuizDetail; onChanged: () => void }) {
  const t = useT();
  const locale = useLocale();
  const path = useLocalePath();
  const router = useRouter();
  const { status } = usePlayer();
  const [open, setOpen] = useState<"report" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run<T extends { ok: boolean; error?: QuizError }>(action: () => Promise<T>, success: string | null) {
    setBusy(true);
    const result = await action().catch(() => ({ ok: false, error: "unavailable" }) as const);
    setBusy(false);
    setOpen(null);
    setMessage(result.ok ? success : QUIZ_ERRORS[locale][result.error ?? "unavailable"]);
    return result.ok;
  }

  const canReport = status === "user" && !quiz.isAuthor && quiz.status === "public";

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-mist">
        {canReport &&
          (quiz.reported ? (
            <span>{t("Tu as signalé ce quiz.", "You reported this quiz.")}</span>
          ) : (
            <button type="button" className="underline underline-offset-4 hover:text-foam" onClick={() => setOpen("report")}>
              {t("Signaler ce quiz", "Report this quiz")}
            </button>
          ))}
        {quiz.canDelete && (
          <button type="button" className="underline underline-offset-4 hover:text-foam" onClick={() => setOpen("delete")}>
            {t("Supprimer ce quiz", "Delete this quiz")}
          </button>
        )}
        {quiz.isAdmin && quiz.status === "hidden" && (
          <button
            type="button"
            disabled={busy}
            className="underline underline-offset-4 hover:text-foam"
            onClick={async () => {
              const done = t("Quiz remis en ligne.", "Quiz back online.");
              if (await run(() => restoreQuizAction(quiz.id), done)) onChanged();
            }}
          >
            {t("Remettre en ligne", "Put back online")}
          </button>
        )}
      </div>

      {open === "report" && (
        <form
          className="space-y-2 rounded-xl border border-sea-600 bg-sea-900/60 p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const thanks = t("Merci, ton signalement est enregistré.", "Thanks, your report has been recorded.");
            if (await run(() => reportQuizAction(quiz.id, reason), thanks)) onChanged();
          }}
        >
          <label className="block">
            <span className="mb-1 block font-semibold text-foam">
              {t("Qu'est-ce qui ne va pas ? (facultatif)", "What's wrong? (optional)")}
            </span>
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={200}
              placeholder={t("Spoiler, insulte, réponse fausse…", "Spoiler, insult, wrong answer…")}
              className="w-full rounded-lg border-2 border-sea-600 bg-sea-900 px-3 py-2 text-foam placeholder:text-mist/60 focus:border-straw focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {t("Envoyer le signalement", "Send the report")}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              {t("Annuler", "Cancel")}
            </Button>
          </div>
        </form>
      )}

      {open === "delete" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-vest/60 bg-vest/10 p-3">
          <span className="font-semibold text-foam">
            {t(`Supprimer définitivement « ${quiz.title} » ?`, `Permanently delete “${quiz.title}”?`)}
          </span>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              if (await run(() => deleteQuizAction(quiz.id), null)) router.push(path("/quiz"));
            }}
          >
            {t("Oui, supprimer", "Yes, delete")}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(null)}>
            {t("Annuler", "Cancel")}
          </Button>
        </div>
      )}

      <p className="min-h-5 font-semibold text-foam" aria-live="polite">
        {message}
      </p>
    </div>
  );
}

export function QuizPlayer({ id }: { id: string }) {
  const t = useT();
  const locale = useLocale();
  const { status, accountsEnabled, refresh } = usePlayer();
  const { quiz, reload } = useQuiz(id);
  const [mode] = useStored<SpoilerMode | null>("opm.mode", null);
  const [spoilersAccepted, setSpoilersAccepted] = useState(false);
  const [seed, setSeed] = useState<number | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);

  const loaded = quiz && quiz !== "missing" ? quiz : null;
  const questions = useMemo(
    () => (loaded && seed !== null ? toDccQuestions(loaded.title, loaded.questions, seed, locale) : []),
    [loaded, seed, locale],
  );

  if (quiz === null) return <LoadingPanel label={t("Chargement du quiz…", "Loading the quiz…")} />;
  if (quiz === "missing" || !loaded) {
    return (
      <Panel className="space-y-3">
        <p className="text-mist">{QUIZ_ERRORS[locale]["not-found"]}</p>
        <Link href="/quiz" className="inline-block font-bold text-straw underline underline-offset-4">
          {t("Voir les quiz de la commu", "See the community quizzes")}
        </Link>
      </Panel>
    );
  }

  function start() {
    setFinished(null);
    setSeed(randomSeed());
  }

  function finish(answers: DccAnswer[]) {
    if (!loaded) return;
    const local = scoreQuiz(loaded.questions, answers);
    if (status !== "user") {
      setFinished({ ...local, server: null });
      return;
    }
    setFinished({ ...local, server: "pending" });
    submitQuizAction(loaded.id, answers)
      .catch(() => ({ ok: false }) as const)
      .then((result) => {
        setFinished({ ...local, server: result.ok ? result.result : "failed" });
        if (result.ok) {
          // Le solde affiché dans l'en-tête et le meilleur score du quiz ont pu changer
          if (result.result.berrys > 0) refresh();
          reload();
        }
      });
  }

  const warning = loaded.spoiler === "manga" && mode !== "manga" && !spoilersAccepted;
  const header = (
    <header className="space-y-1">
      <nav aria-label={t("Fil d'Ariane", "Breadcrumb")} className="text-sm text-mist">
        <Link href="/quiz" className="underline underline-offset-4 hover:text-foam">
          {t("Quiz de la commu", "Community quizzes")}
        </Link>
      </nav>
      <h1 className="font-display text-4xl tracking-wide text-foam sm:text-5xl">{loaded.title}</h1>
      <p className="text-mist">
        {t("Par", "By")} <strong className="text-foam">{loaded.author}</strong> · {loaded.questionCount} questions
        {" · "}
        {t(
          `joué ${formatNumber(loaded.plays, locale)} fois`,
          `played ${formatNumber(loaded.plays, locale)} ${loaded.plays === 1 ? "time" : "times"}`,
        )}
        {loaded.status === "hidden" && (
          <strong className="text-vest"> · {t("masqué après des signalements", "hidden after reports")}</strong>
        )}
      </p>
    </header>
  );

  if (seed !== null && !finished) {
    return (
      <div className="space-y-4">
        {header}
        <DccFlow key={seed} questions={questions} onFinish={(_score, answers) => finish(answers)} />
      </div>
    );
  }

  const server = finished?.server;
  // Le nom du jeu vient du catalogue, comme partout ailleurs
  const dccTitle = getGame("duo-carre-cash")!.title[locale];
  return (
    <div className="space-y-4">
      {header}

      {finished ? (
        <ResultPanel
          title={`${finished.score} / ${finished.max}`}
          actions={
            <>
              <Button onClick={start}>{t("Rejouer", "Play again")}</Button>
              <ShareButton
                label={t("Partager ce quiz", "Share this quiz")}
                getText={() =>
                  t(
                    `${loaded.title} : ${finished.score} / ${finished.max} en ${dccTitle}\n${window.location.href}`,
                    `${loaded.title}: ${finished.score} / ${finished.max} in ${dccTitle}\n${window.location.href}`,
                  )
                }
              />
              <Link href="/quiz" className="rounded-lg px-4 py-2.5 font-bold underline underline-offset-4">
                {t("Autres quiz", "Other quizzes")}
              </Link>
            </>
          }
        >
          {server === "pending" && (
            <p className="text-sm font-semibold">{t("Enregistrement du score…", "Saving your score…")}</p>
          )}
          {server === "failed" && (
            <p className="text-sm font-semibold">{t("Ton score n'a pas pu être enregistré.", "Your score couldn't be saved.")}</p>
          )}
          {server && typeof server === "object" && (
            <>
              {server.reward === "paid" ? (
                <p className="font-display text-3xl tracking-wide text-vest-dark">
                  +{formatNumber(server.berrys, locale)} ฿
                </p>
              ) : (
                <p className="text-sm font-semibold">{REWARD_NOTES[server.reward][locale]}</p>
              )}
              <p className="text-sm font-semibold">
                {t("Ton meilleur score sur ce quiz : ", "Your best score on this quiz: ")}
                {server.best} / {server.max}
              </p>
            </>
          )}
          {server === null && accountsEnabled && (
            <p className="text-sm">
              <Link href="/profil" className="font-semibold underline underline-offset-4">
                {t("Connecte-toi", "Log in")}
              </Link>{" "}
              {t(
                "pour garder ton score et gagner des Berrys sur les quiz de la commu.",
                "to keep your score and earn Berries on community quizzes.",
              )}
            </p>
          )}
        </ResultPanel>
      ) : warning ? (
        <div className="space-y-3 rounded-2xl bg-parchment p-5 text-ink sm:p-6">
          <h2 className="font-display text-3xl tracking-wide">{t("Attention, spoilers", "Careful, spoilers")}</h2>
          <p>
            {t(
              "Son auteur indique que ce quiz porte sur des chapitres du manga pas encore adaptés en anime.",
              "Its author says this quiz covers manga chapters not yet adapted into the anime.",
            )}
            {mode === "anime" && t(" Tu as indiqué suivre l'anime.", " You said you follow the anime.")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setSpoilersAccepted(true)} className="bg-vest text-white hover:bg-vest-dark">
              {t("Je suis à jour sur le manga", "I'm caught up with the manga")}
            </Button>
            <Link href="/quiz" className="rounded-lg px-4 py-2.5 font-bold underline underline-offset-4">
              {t("Choisir un autre quiz", "Pick another quiz")}
            </Link>
          </div>
        </div>
      ) : (
        <Panel className="space-y-4">
          {loaded.description && <p className="text-foam">{loaded.description}</p>}
          <p className="text-mist">
            {t(
              "Avant chaque réponse, choisis ton risque : Duo (deux propositions, 1 point), Carré (quatre propositions, 3 points) ou Cash (aucune proposition, 5 points).",
              "Before each answer, pick your risk: Duo (two choices, 1 point), Quad (four choices, 3 points) or Cash (no choices, 5 points).",
            )}
          </p>
          <p className="text-sm text-mist">
            {loaded.isAuthor
              ? t(
                  "C'est ton quiz : tu peux y jouer, mais il ne te rapporte pas de Berrys.",
                  "It's your quiz: you can play it, but it doesn't earn you any Berries.",
                )
              : loaded.yourBest
                ? t(
                    `Ton meilleur score : ${loaded.yourBest.score} / ${loaded.yourBest.max}. Tu as déjà touché la prime de ce quiz.`,
                    `Your best score: ${loaded.yourBest.score} / ${loaded.yourBest.max}. You've already collected this quiz's bounty.`,
                  )
                : t(
                    `La première fois que tu le termines, ce quiz rapporte jusqu'à ${COMMUNITY_BERRYS} ฿${status === "user" ? "" : ", si tu es connecté"}.`,
                    `The first time you finish it, this quiz earns you up to ${COMMUNITY_BERRYS} ฿${status === "user" ? "" : ", if you're logged in"}.`,
                  )}
          </p>
          <Button onClick={start}>{t("Jouer", "Play")}</Button>
        </Panel>
      )}

      <Moderation quiz={loaded} onChanged={reload} />
    </div>
  );
}
