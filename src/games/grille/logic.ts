/**
 * Grille 3×3 : trois critères en ligne, trois en colonne. Chaque case attend
 * un personnage qui remplit les deux à la fois ; un personnage ne sert qu'une fois.
 */
import type { PlayCharacter, ResolvedData } from "../cards";
import { criteriaFor, type Criterion, type CriterionKind } from "../engine/criteria";
import type { Difficulty } from "../engine/difficulty";
import { createRng, sample } from "../engine/rng";

export const SIZE = 3;
export const CELLS = SIZE * SIZE;

export type Grid = { rows: Criterion[]; columns: Criterion[] };

/** En ligne, d'où vient le personnage ; en colonne, ce qu'il est. Les croisements ont ainsi des réponses. */
const ROW_KINDS: CriterionKind[] = ["affiliation", "group", "sea", "arc"];
const COLUMN_KINDS: CriterionKind[] = ["fruit", "haki", "bounty", "gender", "size", "age", "race"];

/** Nombre de réponses possibles exigé pour chaque case : plus il est bas, plus la grille est dure. */
const MIN_ANSWERS: Record<Difficulty, number> = { facile: 3, normal: 2, expert: 1 };
/** En facile et en normal, les réponses comptées sont des personnages connus. */
const FAMOUS_TIER: Record<Difficulty, number> = { facile: 2, normal: 3, expert: 4 };

export function generate(seed: number, difficulty: Difficulty, data: ResolvedData): Grid | null {
  const rng = createRng(seed);
  const criteria = criteriaFor(data).filter((criterion) => criterion.id !== "race:human");
  const rows = criteria.filter((criterion) => ROW_KINDS.includes(criterion.kind));
  const columns = criteria.filter((criterion) => COLUMN_KINDS.includes(criterion.kind));
  const famous = data.characters.filter((c) => c.tier <= FAMOUS_TIER[difficulty]);

  // Qui remplit chaque critère, parmi les personnages comptés : calculé une fois, les tirages ne font que recouper
  const members = new Map([...rows, ...columns].map((criterion) => [criterion.id, new Set(famous.filter(criterion.test).map((c) => c.id))]));
  const answers = (row: Criterion, column: Criterion) => {
    const inColumn = members.get(column.id)!;
    let count = 0;
    for (const id of members.get(row.id)!) if (inColumn.has(id)) count++;
    return count;
  };

  for (let attempt = 0; attempt < 200; attempt++) {
    const chosen = sample(rng, columns, SIZE);
    if (chosen.length < SIZE) return null;
    // Deux colonnes du même genre se recoupent trop (« a une prime » et « prime d'un milliard »)
    if (new Set(chosen.map((criterion) => criterion.kind)).size < SIZE) continue;
    // Les lignes sont tirées parmi celles qui ont assez de réponses dans chacune des trois colonnes
    const fitting = rows.filter((row) => chosen.every((column) => answers(row, column) >= MIN_ANSWERS[difficulty]));
    if (fitting.length >= SIZE) return { rows: sample(rng, fitting, SIZE), columns: chosen };
  }
  return null;
}

/** Le personnage remplit-il la case (numérotée de gauche à droite, de haut en bas) ? */
export function fits(grid: Grid, cell: number, character: PlayCharacter): boolean {
  return grid.rows[Math.floor(cell / SIZE)].test(character) && grid.columns[cell % SIZE].test(character);
}

/** Une réponse possible pour la case, parmi les personnages les plus connus et pas encore utilisés. */
export function exampleFor(grid: Grid, cell: number, data: ResolvedData, used: ReadonlySet<string>): PlayCharacter | null {
  const answers = data.characters.filter((c) => !used.has(c.id) && fits(grid, cell, c));
  return answers.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name, "fr"))[0] ?? null;
}

/** Cases bien remplies : la réponse convient, et le personnage n'a pas déjà servi dans une case précédente. */
export function scoreAnswers(grid: Grid, answers: readonly (string | null)[], data: ResolvedData): boolean[] {
  const used = new Set<string>();
  return Array.from({ length: CELLS }, (_, cell) => {
    const id = answers[cell];
    const character = id ? data.characterById.get(id) : undefined;
    if (!character || used.has(character.id)) return false;
    used.add(character.id);
    return fits(grid, cell, character);
  });
}

/** Rejoue une partie à partir de sa graine et des réponses données. */
export function evaluate(seed: number, difficulty: Difficulty, answers: readonly (string | null)[], data: ResolvedData) {
  const grid = generate(seed, difficulty, data);
  return { score: grid ? scoreAnswers(grid, answers, data).filter(Boolean).length : 0, max: CELLS };
}
