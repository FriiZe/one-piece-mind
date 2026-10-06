import { DIFFICULTIES, type Difficulty } from "@/games/engine/difficulty";
import { hasDifficulty, isLiveSlug } from "@/lib/games/catalog";
import { isPeriod } from "@/lib/leaderboard/types";
import { accountsEnabled } from "@/lib/server/db";
import { gameLeaderboard, globalLeaderboard } from "@/lib/server/leaderboard";
import { currentUser } from "@/lib/server/session";

/**
 * Classements. Sans paramètre : le classement général, par prime. `?slug=<jeu>&period=day|week|month` :
 * les meilleures parties sur ce jeu pendant la journée, la semaine ou le mois en cours (heure de Paris),
 * et `&difficulty=facile|normal|expert` pour ne garder qu'un niveau.
 */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!accountsEnabled) return Response.json({ error: "unavailable" }, { status: 503, headers });
  const params = new URL(request.url).searchParams;
  const slug = params.get("slug");
  const user = await currentUser();
  if (slug === null) return Response.json(await globalLeaderboard(user?.id ?? null), { headers });
  const period = params.get("period") ?? "day";
  if (!isLiveSlug(slug) || !isPeriod(period)) return Response.json({ error: "not-found" }, { status: 404, headers });
  const level = params.get("difficulty");
  const difficulty = hasDifficulty(slug) && DIFFICULTIES.some((d) => d.id === level) ? (level as Difficulty) : null;
  return Response.json(await gameLeaderboard(slug, period, user?.id ?? null, difficulty), { headers });
}
