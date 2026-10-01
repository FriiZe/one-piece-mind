"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DccFlow } from "@/games/duo-carre-cash/DccFlow";
import type { DccAnswer } from "@/games/duo-carre-cash/logic";
import { randomSeed } from "@/games/engine/rng";
import { formatNumber } from "@/games/engine/text";
import { Button, Panel, ResultPanel, ShareButton } from "@/games/ui/primitives";
import { useStored } from "@/games/ui/storage";
import { LoadingPanel } from "@/games/ui/WithGameData";
import { deleteQuizAction, reportQuizAction, restoreQuizAction, submitQuizAction } from "@/lib/player/quiz-actions";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { useQuiz } from "@/lib/quiz/client";
import { COMMUNITY_BERRYS, scoreQuiz, toDccQuestions } from "@/lib/quiz/rules";
import { QUIZ_ERRORS, type QuizDetail, type QuizPlayResult } from "@/lib/quiz/types";
import type { SpoilerMode } from "@/lib/spoilers";

type Finished = { score: number; max: number; server: QuizPlayResult | "pending" | "failed" | null };

const REWARD_NOTES: Record<Exclude<QuizPlayResult["reward"], "paid">, string> = {
  already: "Tu avais déjà terminé ce quiz : il ne rapporte des Berrys que la première fois.",
  own: "C'est ton quiz : il ne te rapporte pas de Berrys.",
  limit: "Tu as déjà été récompensé pour beaucoup de quiz aujourd'hui : pas de Berrys pour celui-ci.",
};

/** Signalement, suppression, remise en ligne : ce qu'on peut faire d'un quiz en dehors d'y jouer. */
function Moderation({ quiz, onChanged }: { quiz: QuizDetail; onChanged: () => void }) {
  const router = useRouter();
  const { status } = usePlayer();
  const [open, setOpen] = useState<"report" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run<T extends { ok: boolean; error?: keyof typeof QUIZ_ERRORS }>(action: () => Promise<T>, success: string | null) {
    setBusy(true);
    const result = await action().catch(() => ({ ok: false, error: "unavailable" }) as const);
    setBusy(false);
    setOpen(null);
    setMessage(result.ok ? success : QUIZ_ERRORS[result.error ?? "unavailable"]);
    return result.ok;
  }

  const canReport = status === "user" && !quiz.isAuthor && quiz.status === "public";

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-mist">
        {canReport &&
          (quiz.reported ? (
            <span>Tu as signalé ce quiz.</span>
          ) : (
            <button type="button" className="underline underline-offset-4 hover:text-foam" onClick={() => setOpen("report")}>
              Signaler ce quiz
            </button>
          ))}
        {quiz.canDelete && (
          <button type="button" className="underline underline-offset-4 hover:text-foam" onClick={() => setOpen("delete")}>
            Supprimer ce quiz
          </button>
        )}
        {quiz.isAdmin && quiz.status === "hidden" && (
          <button
            type="button"
            disabled={busy}
            className="underline underline-offset-4 hover:text-foam"
            onClick={async () => {
              if (await run(() => restoreQuizAction(quiz.id), "Quiz remis en ligne.")) onChanged();
            }}
          >
            Remettre en ligne
          </button>
        )}
      </div>

      {open === "report" && (
        <form
          className="space-y-2 rounded-xl border border-sea-600 bg-sea-900/60 p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await run(() => reportQuizAction(quiz.id, reason), "Merci, ton signalement est enregistré.")) onChanged();
          }}
        >
          <label className="block">
            <span className="mb-1 block font-semibold text-foam">Qu&apos;est-ce qui ne va pas ? (facultatif)</span>
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={200}
              placeholder="Spoiler, insulte, réponse fausse…"
              className="w-full rounded-lg border-2 border-sea-600 bg-sea-900 px-3 py-2 text-foam placeholder:text-mist/60 focus:border-straw focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              Envoyer le signalement
            </Button>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Annuler
            </Button>
          </div>
        </form>
      )}

      {open === "delete" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-vest/60 bg-vest/10 p-3">
          <span className="font-semibold text-foam">Supprimer définitivement « {quiz.title} » ?</span>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              if (await run(() => deleteQuizAction(quiz.id), null)) router.push("/quiz");
            }}
          >
            Oui, supprimer
          </Button>
          <Button variant="ghost" onClick={() => setOpen(null)}>
            Annuler
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
  const { status, accountsEnabled, refresh } = usePlayer();
  const { quiz, reload } = useQuiz(id);
  const [mode] = useStored<SpoilerMode | null>("opm.mode", null);
  const [spoilersAccepted, setSpoilersAccepted] = useState(false);
  const [seed, setSeed] = useState<number | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);

  const loaded = quiz && quiz !== "missing" ? quiz : null;
  const questions = useMemo(
    () => (loaded && seed !== null ? toDccQuestions(loaded.title, loaded.questions, seed) : []),
    [loaded, seed],
  );

  if (quiz === null) return <LoadingPanel label="Chargement du quiz…" />;
  if (quiz === "missing" || !loaded) {
    return (
      <Panel className="space-y-3">
        <p className="text-mist">{QUIZ_ERRORS["not-found"]}</p>
        <Link href="/quiz" className="inline-block font-bold text-straw underline underline-offset-4">
          Voir les quiz de la commu
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
      <nav aria-label="Fil d'Ariane" className="text-sm text-mist">
        <Link href="/quiz" className="underline underline-offset-4 hover:text-foam">
          Quiz de la commu
        </Link>
      </nav>
      <h1 className="font-display text-4xl tracking-wide text-foam sm:text-5xl">{loaded.title}</h1>
      <p className="text-mist">
        Par <strong className="text-foam">{loaded.author}</strong> · {loaded.questionCount} questions · joué{" "}
        {formatNumber(loaded.plays)} fois
        {loaded.status === "hidden" && <strong className="text-vest"> · masqué après des signalements</strong>}
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
  return (
    <div className="space-y-4">
      {header}

      {finished ? (
        <ResultPanel
          title={`${finished.score} / ${finished.max}`}
          actions={
            <>
              <Button onClick={start}>Rejouer</Button>
              <ShareButton
                label="Partager ce quiz"
                getText={() => `${loaded.title} : ${finished.score} / ${finished.max} en Duo, Carré ou Cash\n${window.location.href}`}
              />
              <Link href="/quiz" className="rounded-lg px-4 py-2.5 font-bold underline underline-offset-4">
                Autres quiz
              </Link>
            </>
          }
        >
          {server === "pending" && <p className="text-sm font-semibold">Enregistrement du score…</p>}
          {server === "failed" && <p className="text-sm font-semibold">Ton score n&apos;a pas pu être enregistré.</p>}
          {server && typeof server === "object" && (
            <>
              {server.reward === "paid" ? (
                <p className="font-display text-3xl tracking-wide text-vest-dark">+{formatNumber(server.berrys)} ฿</p>
              ) : (
                <p className="text-sm font-semibold">{REWARD_NOTES[server.reward]}</p>
              )}
              <p className="text-sm font-semibold">
                Ton meilleur score sur ce quiz : {server.best} / {server.max}
              </p>
            </>
          )}
          {server === null && accountsEnabled && (
            <p className="text-sm">
              <Link href="/profil" className="font-semibold underline underline-offset-4">
                Connecte-toi
              </Link>{" "}
              pour garder ton score et gagner des Berrys sur les quiz de la commu.
            </p>
          )}
        </ResultPanel>
      ) : warning ? (
        <div className="space-y-3 rounded-2xl bg-parchment p-5 text-ink sm:p-6">
          <h2 className="font-display text-3xl tracking-wide">Attention, spoilers</h2>
          <p>
            Son auteur indique que ce quiz porte sur des chapitres du manga pas encore adaptés en anime.
            {mode === "anime" && " Tu as indiqué suivre l'anime."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setSpoilersAccepted(true)} className="bg-vest text-white hover:bg-vest-dark">
              Je suis à jour sur le manga
            </Button>
            <Link href="/quiz" className="rounded-lg px-4 py-2.5 font-bold underline underline-offset-4">
              Choisir un autre quiz
            </Link>
          </div>
        </div>
      ) : (
        <Panel className="space-y-4">
          {loaded.description && <p className="text-foam">{loaded.description}</p>}
          <p className="text-mist">
            Avant chaque réponse, choisis ton risque : Duo (deux propositions, 1 point), Carré (quatre propositions, 3
            points) ou Cash (aucune proposition, 5 points).
          </p>
          <p className="text-sm text-mist">
            {loaded.isAuthor
              ? "C'est ton quiz : tu peux y jouer, mais il ne te rapporte pas de Berrys."
              : loaded.yourBest
                ? `Ton meilleur score : ${loaded.yourBest.score} / ${loaded.yourBest.max}. Tu as déjà touché la prime de ce quiz.`
                : `La première fois que tu le termines, ce quiz rapporte jusqu'à ${COMMUNITY_BERRYS} ฿${status === "user" ? "" : ", si tu es connecté"}.`}
          </p>
          <Button onClick={start}>Jouer</Button>
        </Panel>
      )}

      <Moderation quiz={loaded} onChanged={reload} />
    </div>
  );
}
