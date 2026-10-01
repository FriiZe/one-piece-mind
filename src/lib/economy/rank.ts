import type { PlayerState } from "./types";

/** La prime du joueur grimpe avec tout ce qu'il a gagné, dépensé ou non. */
export function playerBounty(state: Pick<PlayerState, "lifetimeBerrys">): number {
  return state.lifetimeBerrys * 1000;
}

export const RANKS = [
  { title: "Mousse", from: 0 },
  { title: "Rookie", from: 10_000_000 },
  { title: "Supernova", from: 100_000_000 },
  { title: "Corsaire", from: 500_000_000 },
  { title: "Empereur", from: 2_000_000_000 },
] as const;

export function rankOf(bounty: number): { title: string; next: { title: string; from: number } | null } {
  const index = RANKS.findLastIndex((rank) => bounty >= rank.from);
  return { title: RANKS[index].title, next: RANKS[index + 1] ?? null };
}
