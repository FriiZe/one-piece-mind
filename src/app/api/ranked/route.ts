import { rankedOverview } from "@/lib/server/ranked";
import { currentUser } from "@/lib/server/session";

/** Classé du joueur connecté : sa cote, le classement de la saison et ses derniers duels. */
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  return Response.json(await rankedOverview(user), { headers: { "Cache-Control": "no-store" } });
}
