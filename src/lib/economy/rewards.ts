import type { Difficulty } from "@/games/engine/difficulty";
import { randomInt, type Rng } from "@/games/engine/rng";
import type { LiveSlug } from "@/lib/games/catalog";
import { berryBonus, crewBonuses } from "./crew";
import { newlyMet, withGame } from "./objectives";
import type { CollectionEntry, GameOutcome, Milestone, PlayerState, Recruit, Recruitable, Reward } from "./types";
import { currentWeek, weekKey, weeklyChallenges } from "./weekly";

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
  memo: 400,
  wordle: 400,
  anagramme: 400,
  "les-indices": 500,
  surnoms: 350,
  orthographe: 350,
  emojis: 400,
  "devine-la-prime": 500,
  "grand-ou-vieux": 300,
  "premiere-apparition": 500,
  "prime-d-equipage": 500,
  equipage: 350,
  haki: 350,
  techniques: 350,
  "armes-et-sabres": 350,
  navires: 350,
  "origine-et-race": 350,
  chronologie: 500,
  "dans-quel-arc": 350,
  "vrai-ou-faux": 250,
  "mode-aleatoire": 400,
  // Le maximum suppose dix réponses justes sans proposition : la barre est haute, la prime aussi
  "duo-carre-cash": 800,
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

  // Objectifs du jeu atteints avec cette partie
  const stats = withGame(state.stats[outcome.slug], outcome.performance);
  const objectives: Milestone[] = newlyMet(state.stats[outcome.slug], stats).map(({ label, berrys: prize }) => ({
    label,
    berrys: prize,
  }));

  // Défis de la semaine que cette partie fait avancer, et ceux qu'elle termine
  const challenges = weeklyChallenges(weekKey(dayKey));
  const week = currentWeek(state.week, weekKey(dayKey));
  const progress = [...week.progress];
  const done = [...week.done];
  const weekly: Milestone[] = [];
  challenges.forEach((challenge, index) => {
    if (done[index]) return;
    progress[index] = Math.min(challenge.target, progress[index] + challenge.advance(outcome, berrys));
    if (progress[index] >= challenge.target) {
      done[index] = true;
      weekly.push({ label: challenge.label, berrys: challenge.berrys });
    }
  });

  // Les primes d'objectifs et de défis s'ajoutent aux gains, hors plafond journalier
  const total = berrys + [...objectives, ...weekly].reduce((sum, milestone) => sum + milestone.berrys, 0);

  let next: PlayerState = {
    ...state,
    berrys: state.berrys + total,
    lifetimeBerrys: state.lifetimeBerrys + total,
    games: state.games + 1,
    day: { key: dayKey, earned: earnedToday + berrys },
    stats: { ...state.stats, [outcome.slug]: stats },
    week: { key: week.key, progress, done },
  };

  // Le défi du jour réussi assure un recrutement
  const chance = outcome.daily && outcome.performance > 0 ? 1 : recruitChance(outcome.performance, bonuses.recruit);
  const recruit = rng() < chance ? drawRecruit(rng, pool, next, bonuses.golden) : null;
  if (recruit) next = withRecruit(next, recruit);

  return {
    state: next,
    reward: {
      berrys,
      bonus: Math.max(0, Math.min(berrys, wanted - roundToTen(plain))),
      capped: berrys < wanted,
      recruit,
      objectives,
      weekly,
      total,
    },
  };
}

/** Berrys rendus par un doublon défait, selon la rareté (1 = légendaire). */
export const DUPLICATE_VALUE: Record<number, number> = { 1: 1500, 2: 600, 3: 250, 4: 100 };
/** Un doublon doré rapporte davantage. */
export const GOLDEN_DUPLICATE_FACTOR = 3;

/** Exemplaires en trop d'un avis : on en garde toujours un, le doré s'il y en a un. */
export function spareCopies(entry: CollectionEntry | undefined): { plain: number; golden: number } {
  if (!entry) return { plain: 0, golden: 0 };
  const golden = Math.min(entry.golden, entry.count);
  const plain = entry.count - golden;
  return golden > 0 ? { plain, golden: golden - 1 } : { plain: Math.max(0, plain - 1), golden: 0 };
}

/** Ce que rapporteraient les doublons d'un avis s'ils étaient défaits. */
export function duplicatesValue(character: Pick<Recruitable, "tier">, entry: CollectionEntry | undefined): number {
  const spare = spareCopies(entry);
  const value = DUPLICATE_VALUE[character.tier] ?? DUPLICATE_VALUE[4];
  return spare.plain * value + spare.golden * value * GOLDEN_DUPLICATE_FACTOR;
}

/**
 * Défait les doublons d'un avis (ou de tous, avec `null`) contre des Berrys.
 * Ces Berrys ne comptent ni dans la prime du joueur ni dans le plafond du jour :
 * ils rendent une partie de ce qui a déjà été gagné.
 */
export function sellDuplicates(
  state: PlayerState,
  characterById: ReadonlyMap<string, Recruitable>,
  characterId: string | null,
): { state: PlayerState; berrys: number; sold: number; changed: string[] } | "nothing" {
  const ids = characterId === null ? Object.keys(state.collection) : [characterId];
  const collection = { ...state.collection };
  const changed: string[] = [];
  let berrys = 0;
  let sold = 0;

  for (const id of ids) {
    const entry = state.collection[id];
    const character = characterById.get(id);
    // Un avis masqué par le mode spoiler du joueur reste tel quel
    if (!entry || !character) continue;
    const spare = spareCopies(entry);
    if (spare.plain + spare.golden === 0) continue;
    berrys += duplicatesValue(character, entry);
    sold += spare.plain + spare.golden;
    collection[id] = { count: 1, golden: entry.golden > 0 ? 1 : 0 };
    changed.push(id);
  }
  if (sold === 0) return "nothing";
  return { state: { ...state, collection, berrys: state.berrys + berrys }, berrys, sold, changed };
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
