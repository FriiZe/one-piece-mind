import type { CollectionEntry } from "./types";

/** Une version d'un avis possédé : ses exemplaires ordinaires, ou ses dorés. Les deux ne s'empilent pas. */
export type CollectionCopy<T> = { character: T; golden: boolean; count: number };

/** Chaque version des avis possédés, l'ordinaire avant la dorée, dans l'ordre des personnages donnés. */
export function collectionCopies<T extends { id: string }>(
  characters: T[],
  collection: Record<string, CollectionEntry>,
): CollectionCopy<T>[] {
  return characters.flatMap((character) => {
    const entry = collection[character.id];
    if (!entry) return [];
    const plain = entry.count - entry.golden;
    const copies: CollectionCopy<T>[] = [];
    if (plain > 0) copies.push({ character, golden: false, count: plain });
    if (entry.golden > 0) copies.push({ character, golden: true, count: entry.golden });
    return copies;
  });
}
