/**
 * Duo, Carré ou Cash : avant de répondre, le joueur choisit son risque. Deux
 * propositions pour un point, quatre pour trois points, ou aucune pour cinq
 * points, la réponse étant alors à écrire. Les questions viennent des quiz à
 * choix du site ; les quiz de la communauté se jouent avec les mêmes règles.
 */
import type { PlayCharacter, ResolvedData } from "../cards";
import type { Difficulty } from "../engine/difficulty";
import { matchesAnswer, nameForms, normalizeText } from "../engine/text";
import { generateMixed, type MixSlug, type QcmOption } from "../qcm/logic";

export const DCC_LENGTH = 10;
export const DCC_KINDS = ["duo", "carre", "cash"] as const;
export type DccKind = (typeof DCC_KINDS)[number];
export const DCC_POINTS: Record<DccKind, number> = { duo: 1, carre: 3, cash: 5 };
export const DCC_MAX_POINTS = DCC_POINTS.cash;

/** `value` : l'identifiant de la proposition choisie, ou le texte tapé en cash. */
export type DccAnswer = { kind: DccKind; value: string };

export type DccQuestion = {
  id: string;
  /** Consigne, en petit au-dessus du sujet. */
  title: string;
  subject: string;
  detail?: string;
  img?: string | null;
  /** Les quatre propositions du carré. */
  options: QcmOption[];
  answerId: string;
  /** Les deux propositions du duo : la bonne et un leurre. */
  duoIds: string[];
  /** Ce qu'on accepte comme bonne réponse en cash. */
  accepted: string[];
  /** Mauvaises réponses connues : une saisie qui leur ressemble autant qu'à la bonne est refusée. */
  rejected: string[];
  explanation: string;
};

/** Ce qu'il faut d'une question pour juger une réponse. */
export type DccKey = Pick<DccQuestion, "answerId" | "accepted" | "rejected">;

/** Quiz dont la réponse peut s'écrire : ni vrai ou faux, ni duel, ni combinaison de hakis. */
const SOURCES: MixSlug[] = ["equipage", "navires", "origine-et-race", "dans-quel-arc", "techniques", "armes-et-sabres", "surnoms"];

const LABEL_PREFIX = /^(?:équipage|royaume|famille|duché|pays|flotte)\s+(?:de la\s+|de l['’]|des\s+|du\s+|de\s+|d['’]|aux\s+|au\s+)?/i;

/** « Équipage du Chapeau de paille » s'écrit aussi « Chapeau de paille ». */
export function labelForms(label: string): string[] {
  const short = label.replace(LABEL_PREFIX, "").trim();
  return short && short !== label ? [label, short] : [label];
}

const wordCounts = new WeakMap<ResolvedData, Map<string, number>>();

/** Nombre de personnages dont le nom contient chaque mot : « Luffy » n'en désigne qu'un, « Monkey » plusieurs. */
function nameWordCounts(data: ResolvedData): Map<string, number> {
  let counts = wordCounts.get(data);
  if (!counts) {
    counts = new Map();
    for (const character of data.characters) {
      for (const word of nameWords(character)) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    wordCounts.set(data, counts);
  }
  return counts;
}

function nameWords(character: PlayCharacter): Set<string> {
  const words = [character.name, character.altName ?? ""].flatMap((name) => normalizeText(name).split(" "));
  // Trois lettres suffisent : « Law », « Ace », « Kid »
  return new Set(words.filter((word) => word.length >= 3));
}

/** Graphies d'un personnage acceptées en cash : ses noms, et tout mot de son nom qui ne désigne que lui. */
export function characterForms(character: PlayCharacter, data: ResolvedData): string[] {
  const counts = nameWordCounts(data);
  const own = [...nameWords(character)].filter((word) => counts.get(word) === 1);
  return [...new Set([...nameForms(character), ...own])];
}

export function generate(seed: number, difficulty: Difficulty, data: ResolvedData): DccQuestion[] {
  // Quelques questions de plus que nécessaire : celles qui n'ont pas quatre propositions sont écartées
  return generateMixed(seed, SOURCES, DCC_LENGTH + 6, difficulty, data)
    .filter((question) => question.options.length === 4)
    .slice(0, DCC_LENGTH)
    .map((question) => {
      const owner = data.characterById.get(question.answerId);
      const decoy = question.options.find((option) => option.id !== question.answerId)!;
      return {
        ...question,
        duoIds: [question.answerId, decoy.id],
        accepted: owner ? characterForms(owner, data) : labelForms(question.answerId),
        rejected: question.options
          .filter((option) => option.id !== question.answerId)
          .flatMap((option) => (owner ? [option.label] : labelForms(option.label))),
      };
    });
}

export function isRight(question: DccKey, answer: DccAnswer): boolean {
  return answer.kind === "cash"
    ? matchesAnswer(answer.value, question.accepted, question.rejected)
    : answer.value === question.answerId;
}

export function pointsFor(question: DccKey, answer: DccAnswer): number {
  return isRight(question, answer) ? DCC_POINTS[answer.kind] : 0;
}

/** Score d'une série de réponses : le maximum suppose le cash réussi à chaque question. */
export function scoreAnswers(questions: readonly DccKey[], answers: readonly DccAnswer[]) {
  const score = questions.reduce((sum, question, index) => sum + (answers[index] ? pointsFor(question, answers[index]) : 0), 0);
  return { score, max: questions.length * DCC_MAX_POINTS };
}

/** Rejoue une partie à partir de sa graine et des réponses données. */
export function evaluate(seed: number, difficulty: Difficulty, answers: readonly DccAnswer[], data: ResolvedData) {
  return scoreAnswers(generate(seed, difficulty, data), answers);
}
