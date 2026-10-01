import type { Localized } from "@/lib/i18n";
import type { SpoilerMode } from "@/lib/spoilers";
import type { QuizQuestion } from "./rules";

export type QuizSummary = {
  id: string;
  title: string;
  description: string;
  /** Ce qu'il faut avoir vu pour jouer sans être spoilé. */
  spoiler: SpoilerMode;
  author: string;
  questionCount: number;
  /** Nombre de comptes qui l'ont terminé. */
  plays: number;
  createdAt: number;
  /** `hidden` : masqué après plusieurs signalements, visible seulement de son auteur et des administrateurs. */
  status: "public" | "hidden";
  /** Nombre de signalements : donné à l'auteur et aux administrateurs seulement. */
  reports?: number;
  /** Meilleur score du joueur connecté sur ce quiz. */
  yourBest: { score: number; max: number } | null;
};

export type QuizList = {
  /** Faux sans base de données : les quiz de la communauté sont alors fermés. */
  enabled: boolean;
  quizzes: QuizSummary[];
  /** Quiz du joueur connecté, masqués compris. */
  mine: QuizSummary[];
  /** Quiz masqués, pour les administrateurs. */
  hidden: QuizSummary[];
  isAdmin: boolean;
};

export type QuizDetail = QuizSummary & {
  questions: QuizQuestion[];
  isAuthor: boolean;
  /** Le joueur peut supprimer ce quiz : il en est l'auteur, ou il est administrateur. */
  canDelete: boolean;
  isAdmin: boolean;
  /** Le joueur connecté l'a déjà signalé. */
  reported: boolean;
};

export type QuizError = "unavailable" | "invalid" | "limit" | "not-found" | "forbidden" | "own" | "already";
export type QuizResult<T = object> = ({ ok: true } & T) | { ok: false; error: QuizError };

export type QuizPlayResult = {
  score: number;
  max: number;
  /** Meilleur score du joueur sur ce quiz, cette partie comprise. */
  best: number;
  berrys: number;
  /**
   * Pourquoi ce montant : `paid` versé, `already` quiz déjà terminé une fois, `own` c'est son propre quiz,
   * `limit` trop de quiz récompensés aujourd'hui.
   */
  reward: "paid" | "already" | "own" | "limit";
};

export const QUIZ_ERRORS: Localized<Record<QuizError, string>> = {
  fr: {
    unavailable: "Connecte-toi pour faire ça.",
    invalid: "Ce quiz n'est pas valide. Vérifie les questions et réessaie.",
    limit: "Tu as atteint la limite pour aujourd'hui. Réessaie plus tard.",
    "not-found": "Ce quiz n'existe pas, ou plus.",
    forbidden: "Tu n'as pas le droit de faire ça.",
    own: "C'est ton propre quiz.",
    already: "Tu as déjà signalé ce quiz.",
  },
  en: {
    unavailable: "Log in to do that.",
    invalid: "This quiz isn't valid. Check the questions and try again.",
    limit: "You've hit today's limit. Try again later.",
    "not-found": "This quiz doesn't exist, or no longer does.",
    forbidden: "You're not allowed to do that.",
    own: "That's your own quiz.",
    already: "You've already reported this quiz.",
  },
};
