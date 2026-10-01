import type { Difficulty } from "@/games/engine/difficulty";
import type { MixSlug, QcmOption } from "@/games/qcm/logic";
import type { Locale } from "@/lib/i18n";
import type { SpoilerMode } from "@/lib/spoilers";

export type RoomSettings = {
  mode: SpoilerMode;
  difficulty: Difficulty;
  games: MixSlug[];
  questionCount: number;
  seconds: number;
  /** Langue des questions : celle de l'hôte, pour que tout le salon joue les mêmes. */
  lang: Locale;
};

export type RoomPlayerView = {
  id: string;
  name: string;
  score: number;
  rank: number;
  isHost: boolean;
  /** A donné signe de vie récemment. */
  connected: boolean;
  /** A répondu à la question en cours. */
  answered: boolean;
};

export type RoomQuestionView = {
  index: number;
  total: number;
  title: string;
  subject: string;
  detail?: string;
  img?: string | null;
  options: QcmOption[];
  /** Fin du temps de réponse (heure du serveur, en millisecondes). */
  endsAt: number;
  yourAnswer: string | null;
  /** Correction, une fois le temps écoulé : la bonne réponse n'est jamais envoyée avant. */
  reveal: {
    answerId: string;
    explanation: string;
    /** Nombre de joueurs par réponse. */
    counts: Record<string, number>;
    yourPoints: number;
    /** Passage à la question suivante. */
    nextAt: number;
  } | null;
};

export type RoomView = {
  code: string;
  version: number;
  status: "lobby" | "playing" | "finished";
  settings: RoomSettings;
  you: { id: string; isHost: boolean };
  players: RoomPlayerView[];
  /** Heure du serveur à l'envoi : le navigateur s'en sert pour caler son chrono. */
  serverNow: number;
  question: RoomQuestionView | null;
  /** En fin de partie : Berrys versés au joueur s'il a un compte. */
  reward: { berrys: number } | null;
};

export type RoomError =
  | "not-found"
  | "full"
  | "name-taken"
  | "bad-name"
  | "started"
  | "forbidden"
  | "bad-request"
  | "rate-limited"
  | "unavailable";

export type RoomTicket = { code: string; playerId: string; token: string };
export type Result<T> = ({ ok: true } & T) | { ok: false; error: RoomError };
