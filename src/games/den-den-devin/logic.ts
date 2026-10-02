/**
 * Den Den Devin : le joueur pense à un personnage, l'escargophone pose des
 * questions et propose un nom. Chaque réponse est comparée aux fiches des
 * personnages ; une réponse qui contredit une fiche compte contre elle sans
 * l'éliminer, pour pardonner une hésitation du joueur.
 */
import type { PlayCharacter } from "../cards";
import type { Criterion } from "../engine/criteria";

export const MAX_QUESTIONS = 20;
export const MAX_GUESSES = 3;

/** Questions que l'escargophone peut poser : demander l'initiale du nom reviendrait à le faire épeler. */
export const askable = (criterion: Criterion) => criterion.kind !== "initial";

export type Reply = "yes" | "no" | "unknown";
export type Step = { criterionId: string; reply: Reply };

/** Nombre de réponses du joueur que la fiche de chaque personnage contredit. */
function mismatches(character: PlayCharacter, steps: readonly Step[], byId: ReadonlyMap<string, Criterion>): number {
  let count = 0;
  for (const step of steps) {
    if (step.reply === "unknown") continue;
    const criterion = byId.get(step.criterionId);
    if (criterion && criterion.test(character) !== (step.reply === "yes")) count++;
  }
  return count;
}

export type Thinking = {
  /** Personnages qui collent le mieux aux réponses, les plus connus d'abord. */
  best: PlayCharacter[];
  /** Question suivante, ou `null` quand il est temps de proposer un nom. */
  question: Criterion | null;
};

/**
 * Où en est l'escargophone : ses meilleurs candidats, et la question qui les
 * départage le mieux (celle qui les coupe le plus près de la moitié).
 */
export function think(
  characters: readonly PlayCharacter[],
  criteria: readonly Criterion[],
  steps: readonly Step[],
  rejected: ReadonlySet<string>,
): Thinking {
  const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  const scored = characters
    .filter((c) => !rejected.has(c.id))
    .map((character) => ({ character, misses: mismatches(character, steps, byId) }));
  if (!scored.length) return { best: [], question: null };

  const lowest = Math.min(...scored.map((entry) => entry.misses));
  const best = scored
    .filter((entry) => entry.misses === lowest)
    .map((entry) => entry.character)
    .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name, "fr"));
  if (best.length === 1 || steps.length >= MAX_QUESTIONS) return { best, question: null };

  const asked = new Set(steps.map((step) => step.criterionId));
  let question: Criterion | null = null;
  let distance = Infinity;
  for (const criterion of criteria) {
    if (asked.has(criterion.id)) continue;
    const yes = best.filter(criterion.test).length;
    if (yes === 0 || yes === best.length) continue;
    const gap = Math.abs(yes - best.length / 2);
    if (gap < distance) {
      distance = gap;
      question = criterion;
    }
  }
  return { best, question };
}

/** Réponses du joueur que la fiche du personnage contredit : montrées quand l'escargophone s'est trompé. */
export function disagreements(target: PlayCharacter, criteria: readonly Criterion[], steps: readonly Step[]) {
  const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  return steps.flatMap((step) => {
    const criterion = byId.get(step.criterionId);
    if (!criterion || step.reply === "unknown" || criterion.test(target) === (step.reply === "yes")) return [];
    return [{ question: criterion.question, reply: step.reply }];
  });
}
