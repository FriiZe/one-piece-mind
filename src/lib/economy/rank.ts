import type { Localized } from "@/lib/i18n";
import type { PlayerState } from "./types";

/** La prime du joueur grimpe avec tout ce qu'il a gagné, dépensé ou non. */
export function playerBounty(state: Pick<PlayerState, "lifetimeBerrys">): number {
  return state.lifetimeBerrys * 1000;
}

export const RANKS: readonly { title: Localized; from: number }[] = [
  { title: { fr: "Mousse", en: "Cabin Boy" }, from: 0 },
  { title: { fr: "Rookie", en: "Rookie" }, from: 10_000_000 },
  { title: { fr: "Supernova", en: "Supernova" }, from: 100_000_000 },
  { title: { fr: "Corsaire", en: "Warlord" }, from: 500_000_000 },
  { title: { fr: "Empereur", en: "Emperor" }, from: 2_000_000_000 },
];

export function rankOf(bounty: number): { title: Localized; next: { title: Localized; from: number } | null } {
  const index = RANKS.findLastIndex((rank) => bounty >= rank.from);
  return { title: RANKS[index].title, next: RANKS[index + 1] ?? null };
}
