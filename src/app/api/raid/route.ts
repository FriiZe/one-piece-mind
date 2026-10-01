import { accountsEnabled } from "@/lib/server/db";
import { raidView } from "@/lib/server/raid";
import { currentUser } from "@/lib/server/session";

/** Raid de la semaine : l'adversaire, ses points de vie, le classement et la part du joueur connecté. */
export async function GET() {
  if (!accountsEnabled) return Response.json({ error: "unavailable" }, { status: 503 });
  const user = await currentUser();
  return Response.json(await raidView(user?.id ?? null), { headers: { "Cache-Control": "no-store" } });
}
