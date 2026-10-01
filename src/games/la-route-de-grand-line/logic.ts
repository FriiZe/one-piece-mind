/**
 * La Route de Grand Line : une île par arc, dans l'ordre de l'histoire, une
 * question par île sur les personnages qui y apparaissent. Trois vies ; toutes
 * les cinq îles, un boss qui coûte deux vies mais en rend une s'il est battu.
 */
import type { ResolvedData } from "../cards";
import { createRng } from "../engine/rng";
import { questionFor, type QcmQuestion } from "../qcm/logic";

export const LIVES = 3;
export const BOSS_EVERY = 5;
/** Un arc sans assez de personnages n'a pas de quoi poser une question. */
const MIN_CAST = 3;

export type Stage = { arc: number; title: string; boss: boolean; question: QcmQuestion };

export function generateRoute(seed: number, data: ResolvedData): Stage[] {
  const rng = createRng(seed);
  const stages: Stage[] = [];
  for (const [arc, title] of [...data.arcs].sort((a, b) => a[0] - b[0])) {
    const cast = data.characters.filter((c) => c.arc === arc);
    if (cast.length < MIN_CAST) continue;
    const question = questionFor(rng, data, cast);
    if (!question) continue;
    stages.push({ arc, title, boss: (stages.length + 1) % BOSS_EVERY === 0, question });
  }
  return stages;
}

/** Déroulé d'une traversée : vies restantes et îles conquises après ces réponses. */
export function replay(stages: readonly Stage[], answers: readonly string[]) {
  let lives = LIVES;
  let conquered = 0;
  let reached = 0;
  for (const [index, stage] of stages.entries()) {
    if (lives <= 0 || index >= answers.length) break;
    reached = index + 1;
    if (answers[index] === stage.question.answerId) {
      conquered++;
      if (stage.boss) lives = Math.min(LIVES, lives + 1);
    } else {
      lives -= stage.boss ? 2 : 1;
    }
  }
  return { lives: Math.max(0, lives), conquered, reached, over: lives <= 0 || reached === stages.length };
}

/** Rejoue une traversée à partir de sa graine et des réponses : un point par île conquise. */
export function evaluate(seed: number, answers: readonly string[], data: ResolvedData) {
  const stages = generateRoute(seed, data);
  return { score: replay(stages, answers).conquered, max: stages.length };
}
