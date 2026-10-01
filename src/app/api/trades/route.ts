import { currentUser } from "@/lib/server/session";
import { tradesOverview } from "@/lib/server/trades";

/** Propositions d'échange en attente du joueur connecté, reçues et envoyées. */
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  return Response.json(await tradesOverview(user.id), { headers: { "Cache-Control": "no-store" } });
}
