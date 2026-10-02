/**
 * Dans les jeux où l'on compare deux valeurs, c'est l'écart qui fait la difficulté :
 * large en facile, serré en expert. Une fourchette borne cet écart, mesuré comme le
 * jeu l'entend (un rapport entre deux primes, des années entre deux âges).
 */
export type GapBand = { min: number; max: number };

/** Candidats de repli gardés quand aucun n'entre dans la fourchette. */
const NEAREST = 5;

/** De combien un écart sort de la fourchette ; 0 s'il y entre. */
const outside = (gap: number, band: GapBand) => (gap < band.min ? band.min - gap : gap > band.max ? gap - band.max : 0);

/**
 * Candidats dont l'écart entre dans la fourchette. S'il n'y en a aucun, ceux qui
 * s'en approchent le plus : la partie continue, au plus près de sa difficulté.
 */
export function withinGap<T>(candidates: readonly T[], gap: (candidate: T) => number, band: GapBand): T[] {
  const inBand = candidates.filter((candidate) => outside(gap(candidate), band) === 0);
  if (inBand.length) return inBand;
  return [...candidates].sort((a, b) => outside(gap(a), band) - outside(gap(b), band)).slice(0, NEAREST);
}
