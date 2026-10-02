/**
 * Mémo : huit paires à retrouver. Selon la partie, chaque personnage va avec
 * son fruit du démon, son surnom ou son arme.
 */
import type { PlayCharacter, ResolvedData } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, pick, shuffle } from "../engine/rng";
import { translator } from "@/lib/i18n";

export const PAIRS = 8;
/** Nombre de coups au-delà duquel la partie ne rapporte plus que le minimum. */
const WORST_MOVES = 24;
export const MAX_SCORE = WORST_MOVES - PAIRS;

/** Ce qui va avec chaque personnage, le temps d'une partie. */
export const MEMO_THEMES = ["fruit", "epithet", "weapon"] as const;
export type MemoTheme = (typeof MEMO_THEMES)[number];
const THEME_WEIGHTS: Record<MemoTheme, number> = { fruit: 3, epithet: 2, weapon: 1 };
export type MemoCard = { pair: number; kind: "character" | MemoTheme; label: string; img?: string | null };

export function generateDeck(seed: number, difficulty: Difficulty, data: ResolvedData): MemoCard[] {
  const rng = createRng(seed);
  const t = translator(data.locale);
  const pool = byDifficulty(data.characters, difficulty);
  const drawn = new Map(pool.map((c) => [c.id, c]));
  const owned = <T extends { characterId: string }>(items: readonly T[], label: (item: T) => string) =>
    items.filter((item) => drawn.has(item.characterId)).map((item) => ({ character: drawn.get(item.characterId)!, label: label(item) }));

  const candidates: Record<MemoTheme, { character: PlayCharacter; label: string }[]> = {
    fruit: pool
      .filter((c) => c.fruitId && data.fruitById.has(c.fruitId))
      .map((c) => ({ character: c, label: data.fruitById.get(c.fruitId!)!.name })),
    epithet: owned(data.extras.epithets, (epithet) => t(`« ${epithet.text} »`, `“${epithet.text}”`)),
    weapon: owned(data.extras.weapons, (weapon) => weapon.name),
  };
  // Un personnage et un libellé ne figurent qu'une fois : deux utilisateurs du même fruit, ou un
  // porteur de deux sabres, rendraient les paires ambiguës
  const pairsOf = (theme: MemoTheme) => {
    const seen = new Set<string>();
    return shuffle(rng, candidates[theme])
      .filter(({ character, label }) => !seen.has(character.id) && !seen.has(label) && seen.add(character.id) && seen.add(label))
      .slice(0, PAIRS);
  };
  const playable = MEMO_THEMES.map((theme) => ({ theme, pairs: pairsOf(theme) })).filter(({ pairs }) => pairs.length === PAIRS);
  if (!playable.length) return [];

  // Les fruits restent le thème le plus fréquent : ce sont eux qui offrent le plus de paires différentes
  const { theme, pairs } = pick(rng, playable.flatMap((entry) => Array<typeof entry>(THEME_WEIGHTS[entry.theme]).fill(entry)));
  const cards = pairs.flatMap(({ character, label }, pair): MemoCard[] => [
    { pair, kind: "character", label: character.name, img: character.img },
    { pair, kind: theme, label },
  ]);
  return shuffle(rng, cards);
}

/** Thème d'un jeu de cartes : ce que porte la carte qui n'est pas un personnage. */
export function themeOf(deck: readonly MemoCard[]): MemoTheme {
  const card = deck.find((c) => c.kind !== "character");
  return card && card.kind !== "character" ? card.kind : "fruit";
}

/** Points selon le nombre de coups : 16 pour une partie sans erreur (8 coups), 1 au-delà de 23. */
export function scoreFor(moves: number): number {
  return Math.max(1, WORST_MOVES - moves);
}

/**
 * Rejoue une partie : chaque coup retourne deux cartes. La partie ne compte
 * que si toutes les paires ont été trouvées.
 */
export function evaluate(seed: number, difficulty: Difficulty, flips: readonly (readonly [number, number])[], data: ResolvedData) {
  const deck = generateDeck(seed, difficulty, data);
  const matched = new Set<number>();
  let moves = 0;
  for (const [a, b] of flips) {
    if (matched.size === deck.length) break;
    if (a === b || !deck[a] || !deck[b] || matched.has(a) || matched.has(b)) continue;
    moves++;
    if (deck[a].pair === deck[b].pair) {
      matched.add(a);
      matched.add(b);
    }
  }
  return { score: matched.size === deck.length && deck.length > 0 ? scoreFor(moves) : 0, max: MAX_SCORE };
}
