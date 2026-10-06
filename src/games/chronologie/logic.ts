/** Chronologie : remettre cinq arcs, ou cinq personnages, dans l'ordre de l'histoire. */
import type { PlayCharacter, ResolvedData } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, sample, shuffle, type Rng } from "../engine/rng";
import { translator } from "@/lib/i18n";

export const ROUNDS = 5;
export const ROUND_SIZE = 5;
export const MAX_SCORE = ROUNDS * ROUND_SIZE;

export type RankingItem = { id: string; label: string; /** Position dans l'histoire, affichée à la correction. */ detail: string; order: number };
export type RankingRound = { prompt: string; items: RankingItem[] };

function arcRound(rng: Rng, data: ResolvedData): RankingRound {
  const t = translator(data.locale);
  const lastArc = Math.max(...data.characters.map((c) => c.arc ?? 0));
  const arcs = [...data.arcs].filter(([number]) => number <= lastArc);
  const items = sample(rng, arcs, ROUND_SIZE).map(([number, title]) => ({
    id: `arc-${number}`,
    label: title,
    detail: t(`Arc n° ${arcs.findIndex(([n]) => n === number) + 1}`, `Arc #${arcs.findIndex(([n]) => n === number) + 1}`),
    order: number,
  }));
  return { prompt: t("Remets ces arcs dans l'ordre de l'histoire, du premier au dernier.", "Put these arcs in story order, from first to last."), items };
}

function characterRound(rng: Rng, data: ResolvedData, pool: readonly PlayCharacter[]): RankingRound {
  const t = translator(data.locale);
  // Un personnage par arc : deux apparitions à quelques chapitres d'écart seraient impossibles à départager
  const items: RankingItem[] = [];
  const arcs = new Set<number>();
  for (const c of shuffle(rng, pool)) {
    if (c.arc === null || arcs.has(c.arc)) continue;
    arcs.add(c.arc);
    const arc = data.arcs.get(c.arc);
    items.push({ id: c.id, label: c.name, detail: t(`Arc ${arc}`, `${arc} arc`), order: c.debut });
    if (items.length === ROUND_SIZE) break;
  }
  return {
    prompt: t("Range ces personnages par ordre d'apparition, du premier au dernier.", "Sort these characters by order of appearance, from first to last."),
    items,
  };
}

/** La manche n° `index` : les manches paires portent sur les arcs, les impaires sur les personnages. */
export function roundAt(seed: number, index: number, difficulty: Difficulty, data: ResolvedData): RankingRound {
  const rng = createRng(seed + index);
  return index % 2 === 0 ? arcRound(rng, data) : characterRound(rng, data, byDifficulty(data.characters, difficulty));
}

export function correctOrder(round: RankingRound): string[] {
  return [...round.items].sort((a, b) => a.order - b.order).map((item) => item.id);
}

/** Nombre d'éléments placés au bon rang. Un classement qui ne contient pas exactement les éléments de la manche vaut zéro. */
export function scoreRound(round: RankingRound, order: readonly string[]): number {
  const ids = new Set(round.items.map((item) => item.id));
  if (order.length !== ids.size || new Set(order).size !== ids.size || !order.every((id) => ids.has(id))) return 0;
  const expected = correctOrder(round);
  return order.filter((id, index) => expected[index] === id).length;
}

/** Rejoue une partie à partir de sa graine et des classements proposés. */
export function evaluate(seed: number, difficulty: Difficulty, orders: readonly (readonly string[])[], data: ResolvedData, limit = ROUNDS) {
  const rounds = Math.min(limit, ROUNDS);
  let score = 0;
  for (let index = 0; index < rounds; index++) score += scoreRound(roundAt(seed, index, difficulty, data), orders[index] ?? []);
  return { score, max: rounds * ROUND_SIZE };
}
