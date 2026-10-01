/**
 * Quiz de la communauté : ce qu'un joueur a le droit d'écrire, et ce que
 * rapporte un quiz terminé. Règles partagées par le formulaire (navigateur) et
 * le serveur, qui revalide tout.
 */
import { z } from "zod";
import { DCC_KINDS, scoreAnswers, type DccAnswer, type DccQuestion } from "@/games/duo-carre-cash/logic";
import { createRng, shuffle } from "@/games/engine/rng";
import { normalizeText } from "@/games/engine/text";
import { translator, type Locale } from "@/lib/i18n";

export const QUIZ_LIMITS = {
  title: { min: 4, max: 60 },
  description: 300,
  prompt: { min: 5, max: 200 },
  answer: 60,
  questions: { min: 5, max: 30 },
  alternatives: 4,
  /** Quiz qu'un même joueur peut avoir en ligne. */
  perAuthor: 20,
  /** Quiz qu'un joueur peut créer par jour. */
  perDay: 5,
};

/** Signalements de joueurs différents au bout desquels un quiz est masqué. */
export const REPORTS_TO_HIDE = 3;
/** Berrys d'un quiz terminé sans faute en cash ; versés une seule fois par quiz, jamais à son auteur. */
export const COMMUNITY_BERRYS = 150;
/** Quiz récompensés par joueur sur vingt-quatre heures. */
export const COMMUNITY_REWARDS_PER_DAY = 10;

/** Espaces en trop et caractères de contrôle retirés : le texte est affiché tel quel aux autres joueurs. */
export function cleanText(value: string): string {
  return value
    .replace(/[\p{Cc}\u200b\u200c\u200e\u200f\u2028-\u202e\u2060-\u2064\ufeff]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const text = (min: number, max: number) =>
  z
    .string()
    .max(max * 4)
    .transform(cleanText)
    .pipe(z.string().min(min).max(max));

export const quizQuestionSchema = z
  .object({
    prompt: text(QUIZ_LIMITS.prompt.min, QUIZ_LIMITS.prompt.max),
    answer: text(1, QUIZ_LIMITS.answer),
    /** Les trois mauvaises réponses du carré ; la première sert aussi de leurre en duo. */
    wrong: z.array(text(1, QUIZ_LIMITS.answer)).length(3),
    /** Autres façons d'écrire la bonne réponse, acceptées en cash. */
    alternatives: z.array(text(1, QUIZ_LIMITS.answer)).max(QUIZ_LIMITS.alternatives).default([]),
  })
  .refine((question) => new Set([question.answer, ...question.wrong].map(normalizeText)).size === 4);
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const quizQuestionsSchema = z.array(quizQuestionSchema).min(QUIZ_LIMITS.questions.min).max(QUIZ_LIMITS.questions.max);

export const quizInputSchema = z.object({
  title: text(QUIZ_LIMITS.title.min, QUIZ_LIMITS.title.max),
  description: z
    .string()
    .max(QUIZ_LIMITS.description * 4)
    .transform(cleanText)
    .pipe(z.string().max(QUIZ_LIMITS.description)),
  spoiler: z.enum(["anime", "manga"]),
  questions: quizQuestionsSchema,
});
export type QuizInput = z.infer<typeof quizInputSchema>;

export const quizAnswersSchema = z
  .array(z.object({ kind: z.enum(DCC_KINDS), value: z.string().max(120) }))
  .max(QUIZ_LIMITS.questions.max);

/** Brouillon du formulaire : tout y est du texte libre, pas encore validé. */
export type QuizDraft = {
  title: string;
  description: string;
  spoiler: "anime" | "manga";
  questions: { prompt: string; answer: string; wrong: string[]; alternatives: string }[];
};

export function draftToInput(draft: QuizDraft) {
  return {
    title: draft.title,
    description: draft.description,
    spoiler: draft.spoiler,
    questions: draft.questions.map((question) => ({
      prompt: question.prompt,
      answer: question.answer,
      wrong: question.wrong,
      alternatives: question.alternatives
        .split(/[;\n]/)
        .map(cleanText)
        .filter(Boolean),
    })),
  };
}

/** Ce qui empêche de publier le brouillon, en clair ; vide s'il est prêt. */
export function draftProblems(draft: QuizDraft, locale: Locale): string[] {
  const t = translator(locale);
  const problems: string[] = [];
  const title = cleanText(draft.title);
  if (title.length < QUIZ_LIMITS.title.min || title.length > QUIZ_LIMITS.title.max) {
    problems.push(
      t(
        `Le titre doit faire ${QUIZ_LIMITS.title.min} à ${QUIZ_LIMITS.title.max} caractères.`,
        `The title must be ${QUIZ_LIMITS.title.min} to ${QUIZ_LIMITS.title.max} characters long.`,
      ),
    );
  }
  if (cleanText(draft.description).length > QUIZ_LIMITS.description) {
    problems.push(
      t(
        `La description ne doit pas dépasser ${QUIZ_LIMITS.description} caractères.`,
        `The description can't be longer than ${QUIZ_LIMITS.description} characters.`,
      ),
    );
  }
  if (draft.questions.length < QUIZ_LIMITS.questions.min) {
    problems.push(t(`Il faut au moins ${QUIZ_LIMITS.questions.min} questions.`, `You need at least ${QUIZ_LIMITS.questions.min} questions.`));
  }
  if (draft.questions.length > QUIZ_LIMITS.questions.max) {
    problems.push(t(`Pas plus de ${QUIZ_LIMITS.questions.max} questions.`, `No more than ${QUIZ_LIMITS.questions.max} questions.`));
  }

  draftToInput(draft).questions.forEach((question, index) => {
    const label = `Question ${index + 1}`;
    const prompt = cleanText(question.prompt);
    const choices = [question.answer, ...question.wrong].map(cleanText);
    if (prompt.length < QUIZ_LIMITS.prompt.min) problems.push(t(`${label} : l'énoncé est trop court.`, `${label}: the prompt is too short.`));
    else if (prompt.length > QUIZ_LIMITS.prompt.max) {
      problems.push(
        t(`${label} : l'énoncé dépasse ${QUIZ_LIMITS.prompt.max} caractères.`, `${label}: the prompt is over ${QUIZ_LIMITS.prompt.max} characters.`),
      );
    }
    if (choices.some((choice) => !choice)) {
      problems.push(t(`${label} : il faut une bonne réponse et trois mauvaises.`, `${label}: it needs one right answer and three wrong ones.`));
    } else if (new Set(choices.map(normalizeText)).size < 4) {
      problems.push(t(`${label} : les quatre réponses doivent être différentes.`, `${label}: the four answers must all be different.`));
    }
    if ([...choices, ...question.alternatives].some((choice) => choice.length > QUIZ_LIMITS.answer)) {
      problems.push(t(`${label} : une réponse dépasse ${QUIZ_LIMITS.answer} caractères.`, `${label}: an answer is over ${QUIZ_LIMITS.answer} characters.`));
    }
    if (question.alternatives.length > QUIZ_LIMITS.alternatives) {
      problems.push(
        t(`${label} : pas plus de ${QUIZ_LIMITS.alternatives} autres graphies.`, `${label}: no more than ${QUIZ_LIMITS.alternatives} alternative spellings.`),
      );
    }
  });
  return problems;
}

/** Les questions d'un quiz, prêtes à être jouées : propositions mélangées selon la graine. */
export function toDccQuestions(title: string, questions: readonly QuizQuestion[], seed: number, locale: Locale): DccQuestion[] {
  return questions.map((question, index) => ({
    id: String(index),
    title,
    subject: question.prompt,
    options: shuffle(createRng(seed + index), [question.answer, ...question.wrong]).map((label) => ({ id: label, label })),
    answerId: question.answer,
    duoIds: [question.answer, question.wrong[0]],
    accepted: [question.answer, ...question.alternatives],
    rejected: question.wrong,
    explanation: translator(locale)(`La bonne réponse : ${question.answer}.`, `The right answer: ${question.answer}.`),
  }));
}

/** Score d'une partie sur un quiz : le serveur le recalcule à partir des réponses envoyées. */
export function scoreQuiz(questions: readonly QuizQuestion[], answers: readonly DccAnswer[]) {
  return scoreAnswers(
    questions.map((question) => ({
      answerId: question.answer,
      accepted: [question.answer, ...question.alternatives],
      rejected: question.wrong,
    })),
    answers,
  );
}

export function communityBerrys(score: number, max: number): number {
  return max > 0 ? Math.round((COMMUNITY_BERRYS * Math.min(1, score / max)) / 10) * 10 : 0;
}
