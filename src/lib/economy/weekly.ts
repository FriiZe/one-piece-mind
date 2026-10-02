/**
 * Défis de la semaine : six défis, les mêmes pour tous les joueurs, tirés
 * chaque lundi à partir du numéro de la semaine.
 */
import { createRng, pick, sample, seedFromString } from "@/games/engine/rng";
import { GAME_CATEGORIES, GAMES, isRewardless, type Game, type LiveSlug } from "@/lib/games/catalog";
import type { Localized } from "@/lib/i18n";
import { skillFactor } from "./objectives";
import type { ChallengeProgress, GameOutcome, Milestone, WeekProgress } from "./types";

/** Ce qu'un défi a besoin de savoir d'une partie, en plus de son résultat. */
export type ChallengeContext = {
  /** Berrys que la partie elle-même a rapportés. */
  earned: number;
  /** La partie a validé un jeu du jour, ou le défi du jour. */
  paid: boolean;
  /** Défis quotidiens que la partie vient de terminer. */
  dailies: number;
};

export type Challenge = {
  label: Localized;
  target: number;
  berrys: number;
  /** De combien cette partie fait avancer le défi. */
  advance: (outcome: GameOutcome, context: ChallengeContext) => number;
  /** Jeu concerné, pour proposer un lien. */
  slug?: LiveSlug;
  /** Défi de score : sa prime suit la difficulté de la partie qui le réussit (voir `SKILL_FACTOR`). */
  scaled?: boolean;
};

/**
 * Jeux où marquer 80 % des points, ou réussir un sans-faute, se joue vraiment :
 * les quiz et les jeux de classement. Ailleurs (indices, estimations, images,
 * Wordle…), le maximum suppose de trouver du premier coup : on n'en fait pas un défi.
 */
export const SCORE_CHALLENGE_SLUGS: readonly LiveSlug[] = [
  "equipage",
  "navires",
  "origine-et-race",
  "dans-quel-arc",
  "vrai-ou-faux",
  "techniques",
  "armes-et-sabres",
  "surnoms",
  "orthographe",
  "grand-ou-vieux",
  "haki",
  "mode-aleatoire",
  "type-de-fruit",
  "qui-a-mange-ce-fruit",
  "anagramme",
  "trouve-les-tous",
  "plus-ou-moins",
  "connexions",
  "grille",
  "chronologie",
  "le-classement",
];
export const isScoreChallengeGame = (game: Pick<Game, "slug">) => (SCORE_CHALLENGE_SLUGS as readonly string[]).includes(game.slug);

/**
 * Défi calqué sur un objectif de score d'un jeu : marquer la moitié des points,
 * 80 %, ou réussir un sans-faute. Sa prime suit la difficulté de la partie.
 */
export function scoreChallenge(game: Game, target: 0.5 | 0.8 | 1, berrys: number): Challenge {
  const label =
    target === 1
      ? { fr: `Réussir un sans-faute dans « ${game.title.fr} »`, en: `Get a perfect score in “${game.title.en}”` }
      : target === 0.8
        ? { fr: `Marquer 80 % des points dans « ${game.title.fr} »`, en: `Score 80% of the points in “${game.title.en}”` }
        : { fr: `Marquer la moitié des points dans « ${game.title.fr} »`, en: `Score half the points in “${game.title.en}”` };
  return {
    label,
    target: 1,
    berrys,
    slug: game.slug as LiveSlug,
    scaled: true,
    // Le défi du jour partage son identifiant avec OnePiecedle, mais n'est pas une partie libre du jeu
    advance: (outcome) => (outcome.slug === game.slug && !outcome.daily && outcome.performance >= target ? 1 : 0),
  };
}

/** Défi calqué sur un objectif de régularité : jouer plusieurs parties d'un jeu. */
export function playChallenge(game: Game, target: number, berrys: number): Challenge {
  return {
    label: { fr: `Jouer ${target} parties de « ${game.title.fr} »`, en: `Play ${target} games of “${game.title.en}”` },
    target,
    berrys,
    slug: game.slug as LiveSlug,
    advance: (outcome) => (outcome.slug === game.slug ? 1 : 0),
  };
}

/** Prime d'un défi terminé par cette partie. */
export function challengeReward(challenge: Challenge, outcome: GameOutcome): number {
  return challenge.scaled ? Math.round(challenge.berrys * skillFactor(outcome.difficulty)) : challenge.berrys;
}

/** Fait avancer une série de défis avec une partie : nouvel avancement, et primes des défis qu'elle termine. */
export function advanceChallenges(
  challenges: readonly Challenge[],
  state: ChallengeProgress,
  outcome: GameOutcome,
  context: ChallengeContext,
): ChallengeProgress & { completed: Milestone[] } {
  const progress = challenges.map((_, index) => state.progress[index] ?? 0);
  const done = challenges.map((_, index) => !!state.done[index]);
  const completed: Milestone[] = [];
  challenges.forEach((challenge, index) => {
    if (done[index]) return;
    progress[index] = Math.min(challenge.target, progress[index] + challenge.advance(outcome, context));
    if (progress[index] >= challenge.target) {
      done[index] = true;
      completed.push({ label: challenge.label, berrys: challengeReward(challenge, outcome) });
    }
  });
  return { progress, done, completed };
}

/** Semaine ISO d'une date « AAAA-MM-JJ » : elle commence le lundi. */
export function weekKey(dayKey: string): string {
  const DAY = 86_400_000;
  const mondayBased = (date: Date) => (date.getUTCDay() + 6) % 7;
  // Le jeudi de la semaine décide de l'année à laquelle elle appartient
  const day = new Date(`${dayKey}T00:00:00Z`);
  const thursday = new Date(day.getTime() + (3 - mondayBased(day)) * DAY);
  // La première semaine de l'année est celle qui contient le 4 janvier
  const january4 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const firstThursday = january4.getTime() + (3 - mondayBased(january4)) * DAY;
  const week = 1 + Math.round((thursday.getTime() - firstThursday) / (7 * DAY));
  return `${thursday.getUTCFullYear()}-S${String(week).padStart(2, "0")}`;
}

/** Jours restants avant le prochain lundi, jour en cours compris. */
export function daysLeftInWeek(dayKey: string): number {
  const weekday = (new Date(`${dayKey}T00:00:00Z`).getUTCDay() + 6) % 7;
  return 7 - weekday;
}

export function weeklyChallenges(week: string): Challenge[] {
  const rng = createRng(seedFromString(`defis:${week}`));
  const live = GAMES.filter((game) => game.status === "live" && !isRewardless(game.slug));
  const [regular, drawn] = sample(rng, live, 2);
  // Le défi de score porte sur un jeu où il se joue vraiment : sinon, un autre est tiré
  const skilled = isScoreChallengeGame(drawn) ? drawn : pick(rng, live.filter((game) => isScoreChallengeGame(game) && game !== regular));
  const category = pick(rng, GAME_CATEGORIES.filter((entry) => live.some((game) => game.category === entry.id)));
  const weekNumber = Number(week.split("-S")[1]);

  return [
    playChallenge(regular, 5, 1500),
    // Une semaine sur trois, la barre monte : le sans-faute
    weekNumber % 3 === 0 ? scoreChallenge(skilled, 1, 3000) : scoreChallenge(skilled, 0.8, 2000),
    // Une semaine sur deux : le défi du jour, ou les gains
    weekNumber % 2 === 0
      ? {
          label: { fr: "Réussir 3 fois le défi du jour (OnePiecedle)", en: "Win the daily challenge (OnePiecedle) 3 times" },
          target: 3,
          berrys: 2500,
          slug: "onepiecedle",
          advance: (outcome) => (outcome.daily && outcome.performance > 0 ? 1 : 0),
        }
      : {
          label: { fr: "Gagner 5 000 Berrys en jouant", en: "Earn 5,000 Berries by playing" },
          target: 5000,
          berrys: 1500,
          advance: (_outcome, { earned }) => earned,
        },
    {
      label: {
        fr: `Jouer 10 parties dans la catégorie « ${category.title.fr} »`,
        en: `Play 10 games in the “${category.title.en}” category`,
      },
      target: 10,
      berrys: 1500,
      advance: (outcome) => (outcome.category === category.id ? 1 : 0),
    },
    {
      label: { fr: "Valider 12 jeux du jour", en: "Clear 12 daily games" },
      target: 12,
      berrys: 2500,
      advance: (_outcome, { paid }) => (paid ? 1 : 0),
    },
    {
      label: { fr: "Terminer 10 défis quotidiens", en: "Complete 10 daily challenges" },
      target: 10,
      berrys: 2500,
      advance: (_outcome, { dailies }) => dailies,
    },
  ];
}

/**
 * Avancement du joueur pour la semaine donnée : celui d'une semaine passée est
 * remis à zéro. Si des défis ont été ajoutés en cours de semaine, ceux déjà
 * entamés gardent leur avancement : un défi payé ne doit pas l'être deux fois.
 */
export function currentWeek(progress: WeekProgress | undefined, week: string): WeekProgress {
  const count = weeklyChallenges(week).length;
  if (progress?.key !== week) return { key: week, progress: Array(count).fill(0), done: Array(count).fill(false) };
  if (progress.progress.length === count && progress.done.length === count) return progress;
  return {
    key: week,
    progress: Array.from({ length: count }, (_, index) => progress.progress[index] ?? 0),
    done: Array.from({ length: count }, (_, index) => !!progress.done[index]),
  };
}
