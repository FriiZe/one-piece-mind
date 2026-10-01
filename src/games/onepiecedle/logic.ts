import type { PlayCharacter, ResolvedData } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, pick, seedFromString, shuffle } from "../engine/rng";
import { dailyNumber } from "../engine/daily";
import { formatBounty, formatHeight } from "../engine/text";
import { FRUIT_TYPE_LABELS, HAKI_LABELS, SEA_LABELS } from "@/lib/data/labels";

export type Verdict = "exact" | "partial" | "wrong";
/** `up` : la valeur à trouver est plus grande (ou plus tardive) que celle proposée. */
export type Direction = "up" | "down";

export const COLUMNS = [
  { key: "gender", title: "Genre" },
  { key: "affiliation", title: "Affiliation" },
  { key: "fruit", title: "Fruit" },
  { key: "haki", title: "Haki" },
  { key: "bounty", title: "Prime" },
  { key: "height", title: "Taille" },
  { key: "sea", title: "Origine" },
  { key: "arc", title: "Premier arc" },
] as const;

export type ColumnKey = (typeof COLUMNS)[number]["key"];
export type Cell = { key: ColumnKey; label: string; verdict: Verdict; direction?: Direction };

/** Personnages assez renseignés pour que les indices aient un sens. */
export function eligible(characters: readonly PlayCharacter[]): PlayCharacter[] {
  return characters.filter((c) => c.gender !== null && c.affiliation !== null && c.arc !== null);
}

function numeric(key: ColumnKey, label: string, guess: number | null, target: number | null): Cell {
  if (guess === target) return { key, label, verdict: "exact" };
  if (guess === null || target === null) return { key, label, verdict: "wrong" };
  return { key, label, verdict: "wrong", direction: target > guess ? "up" : "down" };
}

const isZoan = (type: string | undefined) => !!type?.startsWith("zoan");

export function compare(guess: PlayCharacter, target: PlayCharacter, data: ResolvedData): Cell[] {
  const fruitType = (c: PlayCharacter) => (c.fruitId ? data.fruitById.get(c.fruitId)?.type : undefined);
  const guessFruit = fruitType(guess);
  const targetFruit = fruitType(target);
  const sharedHaki = guess.haki.filter((h) => target.haki.includes(h)).length;
  const sameHaki = sharedHaki === guess.haki.length && sharedHaki === target.haki.length;

  return [
    {
      key: "gender",
      label: guess.gender === "male" ? "Homme" : guess.gender === "female" ? "Femme" : "Inconnu",
      verdict: guess.gender === target.gender ? "exact" : "wrong",
    },
    {
      key: "affiliation",
      label: guess.affiliation ?? "Aucune",
      verdict: guess.affiliation === target.affiliation ? "exact" : "wrong",
    },
    {
      key: "fruit",
      label: guessFruit ? FRUIT_TYPE_LABELS[guessFruit] : "Aucun",
      verdict:
        guessFruit === targetFruit ? "exact" : isZoan(guessFruit) && isZoan(targetFruit) ? "partial" : "wrong",
    },
    {
      key: "haki",
      label: guess.haki.length ? guess.haki.map((h) => HAKI_LABELS[h]).join(", ") : "Aucun",
      verdict: sameHaki ? "exact" : sharedHaki > 0 ? "partial" : "wrong",
    },
    // Sans prime connue, on compare comme une prime nulle : la flèche reste utile
    numeric("bounty", formatBounty(guess.bounty), guess.bounty ?? 0, target.bounty ?? 0),
    numeric("height", formatHeight(guess.height), guess.height, target.height),
    {
      key: "sea",
      label: guess.sea ? SEA_LABELS[guess.sea] : "Inconnue",
      verdict: guess.sea === target.sea ? "exact" : "wrong",
    },
    numeric("arc", (guess.arc !== null && data.arcs.get(guess.arc)) || "Inconnu", guess.arc, target.arc),
  ];
}

/**
 * Personnage du jour, le même pour tous : tiré parmi les personnages connus
 * des joueurs qui ne suivent que l'anime (`animeCharacters`), sans répétition
 * tant que la liste n'est pas épuisée.
 */
export function dailyTarget(animeCharacters: readonly PlayCharacter[], dayKey: string): PlayCharacter {
  const pool = eligible(animeCharacters)
    .filter((c) => c.tier <= 2)
    .sort((a, b) => a.id.localeCompare(b.id));
  const order = shuffle(createRng(seedFromString("onepiecedle")), pool);
  const index = (((dailyNumber(dayKey) - 1) % order.length) + order.length) % order.length;
  return order[index];
}

const SQUARES: Record<Verdict, string> = { exact: "🟩", partial: "🟨", wrong: "🟥" };

export function shareGrid(rows: Cell[][]): string {
  return rows
    .map((cells) => cells.map((c) => (c.direction === "up" ? "⬆️" : c.direction === "down" ? "⬇️" : SQUARES[c.verdict])).join(""))
    .join("\n");
}

/** Personnage à trouver d'une partie libre. */
export function freeTarget(seed: number, difficulty: Difficulty, characters: readonly PlayCharacter[]): PlayCharacter {
  return pick(createRng(seed), eligible(byDifficulty(characters, difficulty)));
}

/** Nombre d'essais au-delà duquel la réussite ne baisse plus. */
const WORST_ATTEMPTS = 10;

/**
 * Note une partie : 1 si le personnage est trouvé du premier coup, puis de
 * moins en moins à chaque essai, 0 s'il n'est pas trouvé.
 */
export function evaluate(target: PlayCharacter, guesses: readonly string[]) {
  const attempts = guesses.indexOf(target.id) + 1;
  const max = WORST_ATTEMPTS;
  return { score: attempts === 0 ? 0 : Math.max(2, max + 1 - attempts), max };
}
