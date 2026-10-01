import type { Difficulty } from "@/games/engine/difficulty";
import { randomInt, type Rng } from "@/games/engine/rng";
import type { LiveSlug } from "@/lib/games/catalog";
import { berryBonus, crewBonuses } from "./crew";
import type { GameOutcome, PlayerState, Recruit, Recruitable, Reward } from "./types";

/** Berrys d'une partie parfaite en difficulté normale, avant bonus. */
export const BASE_BERRYS: Record<LiveSlug, number> = {
  onepiecedle: 400,
  revelation: 500,
  "zoom-extreme": 500,
  "avis-de-recherche": 500,
  "plus-ou-moins": 500,
  "le-classement": 500,
  "type-de-fruit": 250,
  "qui-a-mange-ce-fruit": 350,
  "trouve-les-tous": 400,
};
export const DAILY_CHALLENGE_BERRYS = 1500;

const DIFFICULTY_FACTOR: Record<Difficulty, number> = { facile: 0.7, normal: 1, expert: 1.5 };

/** Plafond de Berrys gagnés en jouant, par jour (heure de Paris). */
export const DAILY_BERRY_CAP = 20_000;

/** Prix d'un recrutement à la taverne, avant réduction. */
export const TAVERN_COST = 1500;

/** Part de chaque rareté dans les recrutements (1 = légendaire, 4 = commun). */
export const RARITY_WEIGHTS: Record<number, number> = { 1: 4, 2: 14, 3: 32, 4: 50 };
export const RARITY_LABELS: Record<number, string> = { 1: "Légendaire", 2: "Rare", 3: "Peu commun", 4: "Commun" };

export const GOLDEN_CHANCE = 0.04;

const roundToTen = (value: number) => Math.round(value / 10) * 10;

/** Chance de recruter après une partie : nulle sous la moyenne, de 25 % à 60 % au-delà. */
export function recruitChance(performance: number, recruitBonus: number): number {
  if (performance < 0.5) return 0;
  return Math.min(0.9, (0.25 + 0.35 * ((performance - 0.5) / 0.5)) * (1 + recruitBonus));
}

/** Tire un personnage : d'abord la rareté, selon son poids, puis un personnage de cette rareté. */
export function drawRecruit(rng: Rng, pool: readonly Recruitable[], state: PlayerState, goldenBonus: number): Recruit | null {
  const tiers = Object.keys(RARITY_WEIGHTS)
    .map(Number)
    .filter((tier) => pool.some((c) => c.tier === tier));
  if (!tiers.length) return null;

  let roll = rng() * tiers.reduce((sum, tier) => sum + RARITY_WEIGHTS[tier], 0);
  let chosen = tiers[tiers.length - 1];
  for (const tier of tiers) {
    roll -= RARITY_WEIGHTS[tier];
    if (roll < 0) {
      chosen = tier;
      break;
    }
  }
  const candidates = pool.filter((c) => c.tier === chosen);
  const character = candidates[randomInt(rng, candidates.length)];
  return {
    characterId: character.id,
    golden: rng() < GOLDEN_CHANCE * (1 + goldenBonus),
    duplicate: !!state.collection[character.id],
  };
}

function withRecruit(state: PlayerState, recruit: Recruit): PlayerState {
  const entry = state.collection[recruit.characterId] ?? { count: 0, golden: 0 };
  return {
    ...state,
    collection: {
      ...state.collection,
      [recruit.characterId]: { count: entry.count + 1, golden: entry.golden + (recruit.golden ? 1 : 0) },
    },
  };
}

/**
 * Applique le résultat d'une partie : Berrys (bonus d'équipage et plafond
 * journalier compris) et éventuel recrutement. `pool` : les personnages que
 * le joueur a le droit de voir dans son mode spoiler.
 */
export function applyGame(
  state: PlayerState,
  outcome: GameOutcome,
  pool: readonly Recruitable[],
  dayKey: string,
  rng: Rng,
): { state: PlayerState; reward: Reward } {
  const bonuses = crewBonuses(state, new Map(pool.map((c) => [c.id, c])));
  const base = outcome.daily ? DAILY_CHALLENGE_BERRYS : BASE_BERRYS[outcome.slug];
  const plain = base * (outcome.difficulty ? DIFFICULTY_FACTOR[outcome.difficulty] : 1) * outcome.performance;
  const wanted = roundToTen(plain * (1 + berryBonus(bonuses, outcome.category, outcome.daily)));

  const earnedToday = state.day.key === dayKey ? state.day.earned : 0;
  const berrys = Math.max(0, Math.min(wanted, DAILY_BERRY_CAP - earnedToday));

  let next: PlayerState = {
    ...state,
    berrys: state.berrys + berrys,
    lifetimeBerrys: state.lifetimeBerrys + berrys,
    games: state.games + 1,
    day: { key: dayKey, earned: earnedToday + berrys },
  };

  // Le défi du jour réussi assure un recrutement
  const chance = outcome.daily && outcome.performance > 0 ? 1 : recruitChance(outcome.performance, bonuses.recruit);
  const recruit = rng() < chance ? drawRecruit(rng, pool, next, bonuses.golden) : null;
  if (recruit) next = withRecruit(next, recruit);

  return {
    state: next,
    reward: { berrys, bonus: Math.max(0, Math.min(berrys, wanted - roundToTen(plain))), capped: berrys < wanted, recruit },
  };
}

export function tavernCost(discount: number): number {
  return roundToTen(TAVERN_COST * (1 - Math.min(discount, 0.5)));
}

/** Recrutement payant à la taverne : toujours réussi, au prix de `tavernCost`. */
export function buyRecruit(
  state: PlayerState,
  pool: readonly Recruitable[],
  rng: Rng,
): { state: PlayerState; recruit: Recruit; cost: number } | "insufficient" | "empty" {
  const bonuses = crewBonuses(state, new Map(pool.map((c) => [c.id, c])));
  const cost = tavernCost(bonuses.discount);
  if (state.berrys < cost) return "insufficient";
  const paid = { ...state, berrys: state.berrys - cost };
  const recruit = drawRecruit(rng, pool, paid, bonuses.golden);
  if (!recruit) return "empty";
  return { state: withRecruit(paid, recruit), recruit, cost };
}
