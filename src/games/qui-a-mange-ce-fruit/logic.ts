import type { FruitCard, PlayCharacter, ResolvedData } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, sample, shuffle, type Rng } from "../engine/rng";

export type Question =
  | { kind: "fruit-to-user"; fruit: FruitCard; options: PlayCharacter[]; answerId: string }
  | { kind: "user-to-fruit"; character: PlayCharacter; options: FruitCard[]; answerId: string };

const OPTIONS = 4;

/**
 * Questions dans les deux sens : du fruit vers son utilisateur, et l'inverse.
 * `candidates` : les personnages sur lesquels peuvent porter les questions.
 */
export function generateQuiz(rng: Rng, data: ResolvedData, candidates: readonly PlayCharacter[], count = 10): Question[] {
  const eaters = data.characters.filter((c) => c.fruitId && data.fruitById.has(c.fruitId));
  const subjects = sample(
    rng,
    candidates.filter((c) => c.fruitId && data.fruitById.has(c.fruitId)),
    count,
  );

  return subjects.map((subject): Question => {
    const fruit = data.fruitById.get(subject.fruitId!)!;
    if (rng() < 0.5) {
      // Un fruit peut avoir eu plusieurs utilisateurs : aucun d'eux ne doit servir de leurre
      const decoys = sample(rng, eaters.filter((c) => c.fruitId !== fruit.id), OPTIONS - 1);
      return { kind: "fruit-to-user", fruit, options: shuffle(rng, [subject, ...decoys]), answerId: subject.id };
    }
    const decoys = sample(rng, data.fruits.filter((f) => f.id !== fruit.id), OPTIONS - 1);
    return { kind: "user-to-fruit", character: subject, options: shuffle(rng, [fruit, ...decoys]), answerId: fruit.id };
  });
}

export function isCorrect(question: Question, optionId: string): boolean {
  return optionId === question.answerId;
}

/** Pour l'affichage de la correction : le libellé de la bonne réponse. */
export function answerLabel(question: Question): string {
  return question.options.find((o) => o.id === question.answerId)!.name;
}


/** Rejoue une partie à partir de sa graine et des réponses données. */
export function evaluate(seed: number, difficulty: Difficulty, answers: readonly string[], data: ResolvedData, limit?: number) {
  const quiz = generateQuiz(createRng(seed), data, byDifficulty(data.characters, difficulty)).slice(0, limit);
  const score = quiz.filter((question, index) => answers[index] === question.answerId).length;
  return { score, max: quiz.length };
}
