/**
 * Jeux d'indices : retrouver un personnage à partir d'indices dévoilés un à
 * un. Chaque erreur dévoile le suivant ; moins on en utilise, plus on marque.
 */
import type { PlayCharacter, ResolvedData } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, sample, type Rng } from "../engine/rng";
import { formatBounty, normalizeText, revealsName } from "../engine/text";
import { FRUIT_TYPE_LABELS, hakiLabel, RACE_LABELS, SEA_LABELS } from "@/lib/data/labels";
import { translator, type Translate } from "@/lib/i18n";

export const CLUE_ROUNDS = 5;
export const MAX_POINTS = 5;
export const MAX_SCORE = CLUE_ROUNDS * MAX_POINTS;

export type Clue = { title: string; value: string; /** Indice principal, affiché en grand. */ big?: boolean };
export type ClueRound = { target: PlayCharacter; clues: Clue[] };
export type ClueEvent = { type: "guess"; id: string } | { type: "hint" } | { type: "pass" };

/** Points selon le nombre d'indices affichés (le premier est offert) : de 5 à 1. */
export function pointsFor(revealed: number): number {
  return Math.max(1, MAX_POINTS - (revealed - 1));
}

const initialOf = (c: PlayCharacter, t: Translate) =>
  `${c.name[0].toUpperCase()}… (${normalizeText(c.name).replace(/ /g, "").length} ${t("lettres", "letters")})`;

type Generator = (rng: Rng, data: ResolvedData, pool: readonly PlayCharacter[], count: number) => ClueRound[];

/**
 * Indices utilisables pour un personnage : ceux qui ont une valeur et qui ne
 * contiennent pas son nom (« Arc Arlong Park » ou « Équipage d'Arlong » pour Arlong).
 */
function usable(target: PlayCharacter, clues: (Clue | null)[]): Clue[] {
  return clues.filter((clue): clue is Clue => clue !== null && !revealsName(clue.value, target.name));
}

/** Du plus vague au plus précis : l'arc, l'origine, le fruit, le haki, l'affiliation, la prime, l'initiale. */
const lesIndices: Generator = (rng, data, pool, count) => {
  const { locale } = data;
  const t = translator(locale);
  return sample(rng, pool.filter((c) => c.arc !== null && c.affiliation), count).map((target) => {
    const fruit = target.fruitId ? data.fruitById.get(target.fruitId) : undefined;
    const race = target.races.find((r) => r !== "human");
    const arc = data.arcs.get(target.arc!);
    const clues: (Clue | null)[] = [
      { title: t("Première apparition", "First appearance"), value: t(`Arc ${arc}`, `${arc} arc`) },
      target.sea
        ? { title: t("Origine", "Origin"), value: SEA_LABELS[locale][target.sea] + (race ? ` · ${RACE_LABELS[locale][race]}` : "") }
        : null,
      { title: t("Fruit du démon", "Devil Fruit"), value: fruit ? FRUIT_TYPE_LABELS[locale][fruit.type] : t("Aucun", "None") },
      { title: "Haki", value: hakiLabel(target.haki, locale) },
      { title: "Affiliation", value: target.affiliation! },
      { title: t("Prime", "Bounty"), value: formatBounty(target.bounty, locale) },
    ];
    // L'initiale vient toujours en dernier, hors filtre : elle ne peut pas contenir le nom
    return { target, clues: [...usable(target, clues), { title: t("Initiale", "Initial"), value: initialOf(target, t) }] };
  });
};

const emojis: Generator = (rng, data, _pool, count) => {
  const { locale } = data;
  const t = translator(locale);
  return sample(rng, data.extras.emojis, count).map((entry) => {
    const target = data.characterById.get(entry.characterId)!;
    const arc = target.arc !== null ? data.arcs.get(target.arc) : undefined;
    const clues: (Clue | null)[] = [
      { title: t("Qui est-ce ?", "Who is it?"), value: entry.emojis, big: true },
      target.sea ? { title: t("Origine", "Origin"), value: SEA_LABELS[locale][target.sea] } : null,
      target.affiliation ? { title: "Affiliation", value: target.affiliation } : null,
      arc ? { title: t("Première apparition", "First appearance"), value: t(`Arc ${arc}`, `${arc} arc`) } : null,
    ];
    return { target, clues: [...usable(target, clues), { title: t("Initiale", "Initial"), value: initialOf(target, t) }] };
  });
};

const GENERATORS = { "les-indices": lesIndices, emojis } satisfies Record<string, Generator>;

export type ClueSlug = keyof typeof GENERATORS;
export const CLUE_SLUGS = Object.keys(GENERATORS) as [ClueSlug, ...ClueSlug[]];
export const usesDifficulty = (slug: ClueSlug) => slug !== "emojis";

export function generateRounds(slug: ClueSlug, seed: number, difficulty: Difficulty, data: ResolvedData): ClueRound[] {
  return GENERATORS[slug](createRng(seed), data, byDifficulty(data.characters, difficulty), CLUE_ROUNDS);
}

/** Points d'une manche, en rejouant les actions du joueur dans l'ordre. */
export function scoreRound(round: ClueRound, events: readonly ClueEvent[]): number {
  let revealed = 1;
  for (const event of events) {
    if (event.type === "pass") return 0;
    if (event.type === "hint") {
      revealed = Math.min(round.clues.length, revealed + 1);
      continue;
    }
    if (event.id === round.target.id) return pointsFor(revealed);
    // Une erreur dévoile l'indice suivant ; sans indice restant, la manche est perdue
    if (revealed >= round.clues.length) return 0;
    revealed++;
  }
  return 0;
}

/** Rejoue une partie à partir de sa graine et des actions du joueur, manche par manche. */
export function evaluate(slug: ClueSlug, seed: number, difficulty: Difficulty, rounds: readonly (readonly ClueEvent[])[], data: ResolvedData) {
  const generated = generateRounds(slug, seed, difficulty, data);
  const score = generated.reduce((sum, round, index) => sum + scoreRound(round, rounds[index] ?? []), 0);
  return { score, max: generated.length * MAX_POINTS };
}
