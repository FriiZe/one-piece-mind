import "server-only";
import { dailyKey } from "@/games/engine/daily";
import { POST_IDS, sanitizeCosmetics, type PlayerState } from "@/lib/economy";
import type { PlayerProfile } from "@/lib/players/types";
import { seasonKey } from "@/lib/ranked/rules";
import type { SpoilerMode } from "@/lib/spoilers";
import { db } from "./db";
import { gameData } from "./player";

/**
 * Page publique d'un joueur. Sa collection et son équipage n'y montrent que les personnages que le
 * visiteur a le droit de voir dans son mode spoiler : une page de joueur ne révèle rien de plus que
 * le reste du site.
 */
export async function playerProfile(username: string, mode: SpoilerMode, viewerId: string | null): Promise<PlayerProfile | null> {
  const user = await db().user.findUnique({
    where: { usernameKey: username.trim().toLowerCase() },
    select: {
      id: true,
      username: true,
      createdAt: true,
      games: true,
      lifetimeBerrys: true,
      cosmetics: true,
      equipped: true,
      rating: true,
      rankedSeason: true,
      rankedGames: true,
      collection: { select: { characterId: true, count: true, golden: true } },
      crew: { select: { post: true, characterId: true } },
    },
  });
  if (!user) return null;

  const visible = gameData(mode).characterById;
  const collection: PlayerState["collection"] = Object.fromEntries(
    user.collection.filter((entry) => visible.has(entry.characterId)).map((entry) => [entry.characterId, { count: entry.count, golden: entry.golden }]),
  );
  const crew = Object.fromEntries(
    user.crew
      .filter((slot) => (POST_IDS as readonly string[]).includes(slot.post) && visible.has(slot.characterId))
      .map((slot) => [slot.post, slot.characterId]),
  ) as PlayerState["crew"];

  let friendship: PlayerProfile["friendship"] = viewerId ? "none" : "guest";
  let requestId: string | null = null;
  if (viewerId === user.id) friendship = "self";
  else if (viewerId) {
    const link = await db().friendship.findFirst({
      where: {
        OR: [
          { requesterId: viewerId, addresseeId: user.id },
          { requesterId: user.id, addresseeId: viewerId },
        ],
      },
      select: { id: true, status: true, requesterId: true },
    });
    if (link?.status === "accepted") friendship = "friends";
    else if (link) {
      friendship = link.requesterId === viewerId ? "sent" : "received";
      requestId = link.id;
    }
  }

  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt.getTime(),
    games: user.games,
    lifetimeBerrys: user.lifetimeBerrys,
    look: sanitizeCosmetics(user.cosmetics, user.equipped).equipped,
    rating: user.rankedSeason === seasonKey(dailyKey()) && user.rankedGames > 0 ? user.rating : null,
    crew,
    collection,
    known: visible.size,
    friendship,
    requestId,
  };
}
