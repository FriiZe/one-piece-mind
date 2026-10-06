import { accountsEnabled } from "@/lib/server/db";
import { playerProfile } from "@/lib/server/players";
import { currentUser } from "@/lib/server/session";

/** Page publique d'un joueur. `?mode=anime|manga` : le mode spoiler du visiteur, qui filtre ce qu'il voit. */
export async function GET(request: Request, ctx: RouteContext<"/api/players/[username]">) {
  const headers = { "Cache-Control": "no-store" };
  const { username } = await ctx.params;
  const mode = new URL(request.url).searchParams.get("mode") === "manga" ? "manga" : "anime";
  const profile = accountsEnabled && username.length <= 40 ? await playerProfile(username, mode, (await currentUser())?.id ?? null) : null;
  if (!profile) return Response.json({ error: "not-found" }, { status: 404, headers });
  return Response.json(profile, { headers });
}
