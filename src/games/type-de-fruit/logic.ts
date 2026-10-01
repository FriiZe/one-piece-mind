import type { FruitCard } from "../cards";
import { createRng, pick, shuffle, type Rng } from "../engine/rng";
import type { FruitType } from "@/lib/data/schema";

export const QUIZ_LENGTH = 10;

export const FAMILIES = ["paramecia", "logia", "zoan"] as const;
export type FruitFamily = (typeof FAMILIES)[number];

/** Grande famille d'un fruit ; `null` pour les fruits artificiels, hors jeu. */
export function familyOf(type: FruitType): FruitFamily | null {
  if (type === "paramecia" || type === "logia") return type;
  return type.startsWith("zoan") ? "zoan" : null;
}

/**
 * Tire `count` fruits en équilibrant les familles : sans cela, les Paramecia,
 * trois fois plus nombreux, rendraient la réponse trop prévisible.
 */
export function generateQuiz(rng: Rng, fruits: readonly FruitCard[], count = QUIZ_LENGTH): FruitCard[] {
  const remaining = new Map<FruitFamily, FruitCard[]>(
    FAMILIES.map((family) => [family, shuffle(rng, fruits.filter((f) => familyOf(f.type) === family))]),
  );
  const quiz: FruitCard[] = [];
  while (quiz.length < count) {
    const available = FAMILIES.filter((family) => remaining.get(family)!.length > 0);
    if (!available.length) break;
    quiz.push(remaining.get(pick(rng, available))!.pop()!);
  }
  return quiz;
}

/** Rejoue une partie à partir de sa graine et des réponses données. */
export function evaluate(seed: number, answers: readonly string[], fruits: readonly FruitCard[]) {
  const quiz = generateQuiz(createRng(seed), fruits);
  const score = quiz.filter((fruit, index) => answers[index] === familyOf(fruit.type)).length;
  return { score, max: quiz.length };
}
