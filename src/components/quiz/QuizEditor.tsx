"use client";

import Image from "next/image";
import Link from "@/components/Link";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { CheckIcon } from "@/components/GameBadge";
import { DCC_POINTS } from "@/games/duo-carre-cash/logic";
import { Button, Panel } from "@/games/ui/primitives";
import { useStored } from "@/games/ui/storage";
import { LoadingPanel } from "@/games/ui/WithGameData";
import { LOCALE_NAMES, LOCALES } from "@/lib/i18n";
import { useLocale, useLocalePath, useT } from "@/lib/i18n/client";
import { createQuizAction } from "@/lib/player/quiz-actions";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { draftProblems, draftToInput, QUIZ_LIMITS, REPORTS_TO_HIDE, type QuizDraft } from "@/lib/quiz/rules";
import { toThumbnail } from "@/lib/quiz/thumbnail";
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
  const t = useT();
  const locale = useLocale();
  const path = useLocalePath();
  const router = useRouter();
  const { status, accountsEnabled } = usePlayer();
  const [draft, setDraft] = useStored<QuizDraft>("opm.quiz.draft", EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [current, setCurrent] = useState(0);
  const [imageError, setImageError] = useState(false);

  if (status === "loading") return <LoadingPanel />;
  if (status !== "user") {
    return (
      <Panel className="space-y-3">
        <p className="text-mist">
          {accountsEnabled
            ? t(
                "Il faut un compte pour créer un quiz : il porte ton pseudo, et tu peux le supprimer quand tu veux.",
                "You need an account to create a quiz: it carries your username, and you can delete it whenever you like.",
              )
            : t("La création de quiz n'est pas disponible pour l'instant.", "Quiz creation isn't available right now.")}
        </p>
        {accountsEnabled && (
          <Link href="/profil" className="inline-block rounded-lg bg-straw px-4 py-2.5 font-bold text-ink hover:bg-straw-dark">
            {t("Se connecter ou créer un compte", "Log in or create an account")}
          </Link>
        )}
      </Panel>
    );
  }

  const problems = draftProblems(draft, locale);
  const setQuestion = (index: number, change: Partial<QuizDraft["questions"][number]>) =>
    setDraft({ ...draft, questions: draft.questions.map((question, i) => (i === index ? { ...question, ...change } : question)) });

  // Une question retirée ailleurs peut laisser la sélection au-delà de la liste
  const index = Math.min(current, draft.questions.length - 1);
  const question = draft.questions[index];
  const ready = draft.questions.filter(isComplete).length;
  // Tant que l'auteur n'a rien choisi, le quiz est supposé écrit dans la langue où il lit le site
  const language = draft.language ?? locale;
  const { min, max } = QUIZ_LIMITS.questions;

  async function publish() {
    setChecked(true);
    setError(null);
    if (problems.length) return;
    setBusy(true);
    const result = await createQuizAction(draftToInput(draft, locale)).catch(() => ({ ok: false, error: "unavailable" }) as const);
    setBusy(false);
    if (!result.ok) {
      setError(QUIZ_ERRORS[locale][result.error]);
      return;
    }
    setDraft(EMPTY_DRAFT);
    router.push(path(`/quiz/${result.id}`));
  }

  async function pickThumbnail(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Le champ est vidé : choisir deux fois le même fichier doit déclencher deux fois l'événement
    event.target.value = "";
    if (!file) return;
    const thumbnail = await toThumbnail(file);
    setImageError(!thumbnail);
    if (thumbnail) setDraft({ ...draft, thumbnail });
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
              <span className={LABEL}>{t("Titre", "Title")}</span>
              <input
                type="text"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                maxLength={QUIZ_LIMITS.title.max}
                placeholder={t("Les sabres de Wano", "The swords of Wano")}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={LABEL}>
                {t("En une phrase", "In one sentence")}{" "}
                <span className="font-normal text-mist">{t("(facultatif)", "(optional)")}</span>
              </span>
              <textarea
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                maxLength={QUIZ_LIMITS.description}
                rows={2}
                placeholder={t("De quoi parle ton quiz, et pour qui.", "What your quiz is about, and who it's for.")}
                className={`${FIELD} h-auto py-2.5`}
              />
            </label>
            <fieldset>
              <legend className={LABEL}>
                {t("Pour jouer sans être spoilé, il faut suivre", "To play without being spoiled, you need to follow")}
              </legend>
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
                    {value === "anime" ? t("l'anime", "the anime") : t("le manga", "the manga")}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[13px] text-mist">
                {draft.spoiler === "anime"
                  ? t(
                      "Aucune question ne doit porter sur des chapitres pas encore adaptés en anime.",
                      "No question may be about chapters not yet adapted into the anime.",
                    )
                  : t(
                      "Les joueurs qui ne suivent que l'anime seront prévenus avant de jouer.",
                      "Players who only follow the anime will be warned before playing.",
                    )}
              </p>
            </fieldset>
            <fieldset>
              <legend className={LABEL}>{t("Le quiz est rédigé en", "The quiz is written in")}</legend>
              <div className="grid grid-cols-2 rounded-xl bg-sea-900 p-1">
                {LOCALES.map((value) => (
                  <label
                    key={value}
                    className={`flex min-h-11 cursor-pointer items-center justify-center rounded-[9px] text-[15px] font-extrabold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-straw ${
                      language === value ? "bg-straw text-ink" : "text-mist hover:text-foam"
                    }`}
                  >
                    <input
                      type="radio"
                      name="language"
                      value={value}
                      checked={language === value}
                      onChange={() => setDraft({ ...draft, language: value })}
                      className="sr-only"
                    />
                    {LOCALE_NAMES[value]}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[13px] text-mist">
                {t(
                  "Une étiquette l'indique dans la liste des quiz, où l'on peut filtrer par langue.",
                  "A tag shows it in the quiz list, where players can filter by language.",
                )}
              </p>
            </fieldset>
            <div>
              <p className={LABEL}>
                {t("Vignette", "Thumbnail")} <span className="font-normal text-mist">{t("(facultatif)", "(optional)")}</span>
              </p>
              {draft.thumbnail && (
                <span className="relative mb-2 block aspect-video overflow-hidden rounded-[10px] border border-sea-600">
                  <Image src={draft.thumbnail} alt={t("Vignette du quiz", "Quiz thumbnail")} fill unoptimized className="object-cover" />
                </span>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-h-11 cursor-pointer items-center rounded-[10px] border border-dashed border-sea-600 px-4 text-sm font-extrabold text-foam transition-colors hover:border-straw has-focus-visible:outline-2 has-focus-visible:outline-straw">
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickThumbnail} className="sr-only" />
                  {draft.thumbnail ? t("Changer d'image", "Change the image") : t("Choisir une image", "Choose an image")}
                </label>
                {draft.thumbnail && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, thumbnail: null })}
                    className="min-h-11 cursor-pointer px-2 text-sm font-bold text-[#f5a88a] hover:underline"
                  >
                    {t("Retirer", "Remove")}
                  </button>
                )}
              </div>
              {imageError ? (
                <p role="alert" className="mt-2 text-[13px] font-semibold text-vest">
                  {t("Cette image n'a pas pu être lue. Essaie un fichier JPEG, PNG ou WebP.", "This image couldn't be read. Try a JPEG, PNG or WebP file.")}
                </p>
              ) : (
                <p className="mt-2 text-[13px] text-mist">
                  {t(
                    "Affichée dans la liste des quiz. Elle est recadrée au format 16:9 et réduite avant l'envoi.",
                    "Shown in the quiz list. It's cropped to 16:9 and shrunk before it's sent.",
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5 rounded-2xl border border-sea-700 p-3">
            <h2 className="px-1.5 py-1 text-xs font-extrabold tracking-[0.15em] text-mist uppercase">
              {t(
                `Questions · ${draft.questions.length} sur ${max} au plus`,
                `Questions · ${draft.questions.length} of ${max} at most`,
              )}
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
                      <span className={`min-w-0 flex-1 truncate ${q.prompt.trim() ? "" : "text-mist"}`}>
                        {q.prompt.trim() || t("Question sans énoncé", "Question with no text")}
                      </span>
                      {complete ? (
                        <CheckIcon className="size-3.5 shrink-0 text-emerald-300" />
                      ) : (
                        <span className="shrink-0 text-xs font-extrabold text-[#f5a88a]">
                          {t("à finir", "unfinished")}
                        </span>
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
                {t("Ajouter une question", "Add a question")}
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
                {t("Supprimer la question", "Delete the question")}
              </button>
            )}
          </div>
          <label className="block">
            <span className={LABEL}>{t("Énoncé", "Question text")}</span>
            <textarea
              value={question.prompt}
              onChange={(event) => setQuestion(index, { prompt: event.target.value })}
              maxLength={QUIZ_LIMITS.prompt.max}
              rows={2}
              placeholder={t("Quel sabre Zoro reçoit-il à Wano ?", "Which sword does Zoro receive in Wano?")}
              className={`${FIELD} h-auto py-2.5`}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={`${LABEL} text-emerald-300`}>{t("Bonne réponse", "Correct answer")}</span>
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
                <span className={LABEL}>
                  {w === 0
                    ? t("Fausse réponse du Duo", "Wrong answer for Duo")
                    : t("Fausse réponse du Carré", "Wrong answer for Quad")}
                </span>
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
              {t("Autres écritures acceptées en Cash", "Other spellings accepted in Cash")}{" "}
              <span className="font-normal text-mist">{t("(facultatif)", "(optional)")}</span>
            </span>
            <input
              type="text"
              value={question.alternatives}
              onChange={(event) => setQuestion(index, { alternatives: event.target.value })}
              placeholder={t("Enma ; Emma", "Enma; Emma")}
              className={FIELD}
            />
            <span className="mt-1.5 block text-[13px] text-mist">
              {t(
                "Séparées par un point-virgule. Majuscules, accents et petites fautes de frappe sont déjà tolérés.",
                "Separated by a semicolon. Capitals, accents and small typos are already tolerated.",
              )}
            </span>
          </label>

          <div className="space-y-2.5 rounded-[14px] border border-sea-700 px-4 py-3.5">
            <h3 className="text-xs font-extrabold tracking-[0.15em] text-mist uppercase">
              {t("Ce que verra le joueur", "What the player will see")}
            </h3>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="font-extrabold text-[#8fd0f0]">Duo · {DCC_POINTS.duo} pt</dt>
                <dd className="text-mist">
                  {[question.answer, question.wrong[0]].map((v) => v.trim() || "…").join(t(" ou ", " or "))}
                </dd>
              </div>
              <div>
                <dt className="font-extrabold text-violet-300">
                  {t("Carré", "Quad")} · {DCC_POINTS.carre} pts
                </dt>
                <dd className="text-mist">{[question.answer, ...question.wrong].map((v) => v.trim() || "…").join(", ")}</dd>
              </div>
              <div>
                <dt className="font-extrabold text-straw">Cash · {DCC_POINTS.cash} pts</dt>
                <dd className="text-mist">{t("Un champ vide à remplir", "An empty field to fill in")}</dd>
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
          {problems.length > 8 && (
            <li>
              {t(
                `… et ${problems.length - 8} autres points à corriger.`,
                `… and ${problems.length - 8} more ${problems.length - 8 === 1 ? "thing" : "things"} to fix.`,
              )}
            </li>
          )}
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
              {t(
                `${ready} question${ready > 1 ? "s" : ""} prête${ready > 1 ? "s" : ""} sur ${min} au minimum`,
                `${ready} ${ready === 1 ? "question" : "questions"} ready out of a minimum of ${min}`,
              )}
            </span>
            <span className="text-mist">{max} max</span>
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-sea-700">
            <div className={`h-full ${ready >= min ? "bg-emerald-300" : "bg-straw"}`} style={{ width: `${Math.min(1, ready / min) * 100}%` }} />
          </div>
        </div>
        <p className="min-w-0 flex-1 text-sm text-mist">
          {t(
            `Visible de tous, sous ton pseudo. Pas d'insultes, pas d'image déplacée, pas de spoilers au-delà de ce que tu as indiqué : un quiz signalé par ${REPORTS_TO_HIDE} joueurs est masqué. Ton brouillon est gardé dans ce navigateur.`,
            `Visible to everyone, under your username. No insults, no inappropriate image, and no spoilers beyond what you've indicated: a quiz reported by ${REPORTS_TO_HIDE} players gets hidden. Your draft is kept in this browser.`,
          )}
        </p>
        <Button type="submit" disabled={busy} className="min-h-12 px-6">
          {busy ? t("Publication…", "Publishing…") : t("Publier le quiz", "Publish the quiz")}
        </Button>
      </div>
    </form>
  );
}
