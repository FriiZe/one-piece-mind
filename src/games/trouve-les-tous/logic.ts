import type { GroupCard, PlayCharacter } from "../cards";
import { nameForms, normalizeText } from "../engine/text";

/** Temps accordé, en secondes : douze par personnage, une minute au minimum. */
export function timeLimit(memberCount: number): number {
  return Math.max(60, memberCount * 12);
}

/**
 * Saisies acceptées pour chaque membre du groupe : ses noms complets, et tout
 * mot de son nom qui ne désigne que lui dans le groupe (« Zoro », mais pas
 * « Vinsmoke » dans la famille Vinsmoke).
 */
export function acceptedForms(members: readonly PlayCharacter[]): Map<string, string> {
  const forms = new Map<string, string>();
  const wordOwners = new Map<string, Set<string>>();

  for (const member of members) {
    for (const form of nameForms(member)) {
      forms.set(form, member.id);
      for (const word of form.split(" ")) {
        if (word.length < 3) continue;
        if (!wordOwners.has(word)) wordOwners.set(word, new Set());
        wordOwners.get(word)!.add(member.id);
      }
    }
  }
  for (const [word, owners] of wordOwners) {
    if (owners.size === 1 && !forms.has(word)) forms.set(word, [...owners][0]);
  }
  return forms;
}

/** Membre désigné par la saisie, s'il n'a pas déjà été trouvé. */
export function matchMember(input: string, forms: Map<string, string>, found: ReadonlySet<string>): string | null {
  const id = forms.get(normalizeText(input));
  return id && !found.has(id) ? id : null;
}

export function membersOf(group: GroupCard, characterById: Map<string, PlayCharacter>): PlayCharacter[] {
  return group.memberIds.map((id) => characterById.get(id)!);
}

/** Compte les membres réellement trouvés : chaque identifiant doit appartenir au groupe, une seule fois. */
export function evaluate(group: GroupCard, found: readonly string[]) {
  const members = new Set(group.memberIds);
  const score = new Set(found.filter((id) => members.has(id))).size;
  return { score, max: group.memberIds.length };
}
