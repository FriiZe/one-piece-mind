/**
 * Connexions : seize personnages, quatre familles cachées de quatre. Le
 * joueur les regroupe ; quatre erreurs et la partie s'arrête.
 */
import type { PlayCharacter, ResolvedData } from "../cards";
import { criteriaFor, type Criterion, type CriterionKind } from "../engine/criteria";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, sample, shuffle } from "../engine/rng";

export const GROUPS = 4;
export const GROUP_SIZE = 4;
export const MAX_MISTAKES = 4;

export type ConnexionGroup = { id: string; label: string; memberIds: string[] };
export type Puzzle = { groups: ConnexionGroup[]; tiles: PlayCharacter[] };

/** Familles qui font de bonnes énigmes : précises, et pas devinables d'un coup d'œil sur le portrait. */
const KINDS: CriterionKind[] = ["affiliation", "group", "sea", "race", "fruit", "haki", "bounty", "arc", "initial"];
const TOO_BROAD = new Set(["fruit:any", "fruit:none", "haki:any", "bounty:any", "bounty:100m", "race:human"]);

function usable(criterion: Criterion): boolean {
  return KINDS.includes(criterion.kind) && !TOO_BROAD.has(criterion.id);
}

export function generate(seed: number, difficulty: Difficulty, data: ResolvedData): Puzzle | null {
  const rng = createRng(seed);
  const pool = byDifficulty(data.characters, difficulty);
  const families = criteriaFor(data)
    .filter(usable)
    .map((criterion) => ({ criterion, members: pool.filter(criterion.test) }))
    .filter((family) => family.members.length >= GROUP_SIZE);

  for (let attempt = 0; attempt < 300; attempt++) {
    const chosen = sample(rng, families, GROUPS);
    if (chosen.length < GROUPS) return null;
    // Pas plus de deux familles du même genre : quatre équipages feraient une énigme trop facile à lire
    const kinds = chosen.map((family) => family.criterion.kind);
    if (kinds.some((kind) => kinds.filter((k) => k === kind).length > 2)) continue;
    // L'initiale du nom est un piège : une seule famille de ce genre au plus, et dans une minorité d'énigmes
    const initials = kinds.filter((kind) => kind === "initial").length;
    if (initials > 1 || (initials === 1 && rng() < 0.6)) continue;

    // Un personnage ne doit entrer que dans une seule des quatre familles
    const groups: ConnexionGroup[] = [];
    for (const family of chosen) {
      const exclusive = family.members.filter((c) => chosen.every((other) => other === family || !other.criterion.test(c)));
      if (exclusive.length < GROUP_SIZE) break;
      groups.push({
        id: family.criterion.id,
        label: family.criterion.label,
        memberIds: sample(rng, exclusive, GROUP_SIZE).map((c) => c.id),
      });
    }
    if (groups.length < GROUPS) continue;

    const ids = groups.flatMap((group) => group.memberIds);
    return { groups, tiles: shuffle(rng, ids).map((id) => data.characterById.get(id)!) };
  }
  return null;
}

/** Famille que forment exactement ces quatre personnages, s'il y en a une. */
export function groupOf(puzzle: Puzzle, ids: readonly string[]): ConnexionGroup | null {
  if (new Set(ids).size !== GROUP_SIZE) return null;
  return puzzle.groups.find((group) => ids.every((id) => group.memberIds.includes(id))) ?? null;
}

/** Trois des quatre personnages choisis appartiennent-ils à une même famille ? */
export function oneAway(puzzle: Puzzle, ids: readonly string[]): boolean {
  return puzzle.groups.some((group) => ids.filter((id) => group.memberIds.includes(id)).length === GROUP_SIZE - 1);
}

/** Déroulé d'une série de propositions : familles trouvées, erreurs commises. */
export function replay(puzzle: Puzzle, guesses: readonly (readonly string[])[]) {
  const found: string[] = [];
  let mistakes = 0;
  for (const guess of guesses) {
    if (mistakes >= MAX_MISTAKES || found.length === GROUPS) break;
    const group = groupOf(puzzle, guess);
    if (group && !found.includes(group.id)) found.push(group.id);
    else mistakes++;
  }
  return { found, mistakes, over: mistakes >= MAX_MISTAKES || found.length === GROUPS };
}

/** Rejoue une partie à partir de sa graine et des propositions : un point par famille trouvée. */
export function evaluate(seed: number, difficulty: Difficulty, guesses: readonly (readonly string[])[], data: ResolvedData) {
  const puzzle = generate(seed, difficulty, data);
  return { score: puzzle ? replay(puzzle, guesses).found.length : 0, max: GROUPS };
}
