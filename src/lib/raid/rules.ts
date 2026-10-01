/**
 * Règles du raid : chaque semaine, toute la communauté affronte le même
 * adversaire, un Empereur ou un Amiral. Un assaut est un quiz de dix
 * questions ; chaque bonne réponse lui retire des points de vie, davantage
 * avec un bon équipage. Calcul pur, partagé par le serveur et l'interface.
 */
import { POST_IDS, postStrength, type PlayerState, type Recruitable } from "@/lib/economy";
import type { Localized } from "@/lib/i18n";

export type BossKind = "emperor" | "admiral";

/**
 * Adversaires, dans l'ordre où ils se succèdent : un Empereur, puis un Amiral.
 * Tous sont connus de ceux qui ne suivent que l'anime.
 */
export const RAID_BOSSES: readonly { id: string; kind: BossKind }[] = [
  { id: "kaidou", kind: "emperor" },
  { id: "sakazuki", kind: "admiral" },
  { id: "charlotte-linlin", kind: "emperor" },
  { id: "borsalino", kind: "admiral" },
  { id: "shanks", kind: "emperor" },
  { id: "kuzan", kind: "admiral" },
  { id: "marshall-d-teach", kind: "emperor" },
  { id: "issho", kind: "admiral" },
  { id: "edward-newgate", kind: "emperor" },
  { id: "aramaki", kind: "admiral" },
];

export const BOSS_KINDS: Localized<Record<BossKind, string>> = {
  fr: { emperor: "Empereur", admiral: "Amiral" },
  en: { emperor: "Emperor", admiral: "Admiral" },
};

/** Adversaire d'une semaine « 2026-S40 » : ils tournent, semaine après semaine. */
export function raidBoss(week: string): (typeof RAID_BOSSES)[number] {
  const [year, number] = week.split("-S").map(Number);
  return RAID_BOSSES[(year * 53 + number) % RAID_BOSSES.length];
}

export const RAID_ATTACKS_PER_DAY = 3;
export const RAID_QUESTIONS = 10;
/** Temps de réponse par question, en secondes. */
export const RAID_SECONDS = 15;
/** Délai total accordé à un assaut : le temps de toutes les questions, plus une marge pour l'envoi. */
export const RAID_ATTACK_MS = (RAID_QUESTIONS * RAID_SECONDS + 20) * 1000;

/** Dégâts d'une bonne réponse, avant bonus. */
export const RAID_BASE_DAMAGE = 100;
/** Un assaut sans faute frappe plus fort. */
export const RAID_PERFECT_BONUS = 0.25;

/**
 * Bonus de dégâts de l'équipage : chaque poste pourvu y ajoute sa force, selon
 * la rareté du personnage (voir `postStrength`). Un personnage que le mode
 * spoiler du joueur ne montre pas ne compte pas.
 */
export function raidCrewBonus(state: Pick<PlayerState, "crew" | "collection">, characterById: ReadonlyMap<string, Recruitable>): number {
  let bonus = 0;
  for (const post of POST_IDS) {
    const id = state.crew[post];
    const character = id ? characterById.get(id) : undefined;
    if (id && character && state.collection[id]) bonus += postStrength(character, state.collection[id], post);
  }
  return Math.round(bonus * 1000) / 1000;
}

export function raidDamage(correct: number, crewBonus: number): number {
  const perfect = correct >= RAID_QUESTIONS ? RAID_PERFECT_BONUS : 0;
  return Math.round(Math.max(0, correct) * RAID_BASE_DAMAGE * (1 + crewBonus) * (1 + perfect));
}

/** Berrys d'un assaut, versés tout de suite, dans la limite du plafond journalier. */
export function raidAttackBerrys(damage: number): number {
  return Math.round(damage / 50) * 10;
}

const HP_PER_PLAYER = 4000;
const MIN_HP = 40_000;
const MAX_HP = 5_000_000;

/**
 * Points de vie de l'adversaire, fixés à l'ouverture du raid d'après le nombre
 * de joueurs venus dans la semaine : quatre ou cinq bons assauts par joueur
 * actif suffisent à le vaincre.
 */
export function raidHp(activePlayers: number): number {
  return Math.min(MAX_HP, Math.max(MIN_HP, Math.round((activePlayers * HP_PER_PLAYER) / 1000) * 1000));
}

/**
 * Butin d'un raid vaincu, pour chaque joueur qui a infligé au moins
 * `minDamage` : des Berrys et l'avis de recherche de l'adversaire. Les
 * `podium` premiers reçoivent un avis doré et un titre.
 */
export const RAID_LOOT = { berrys: 3000, minDamage: 500, podium: 3, cosmetic: "title-fleau" } as const;
