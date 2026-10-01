import { friendsOverview } from "@/lib/server/friends";
import { currentUser } from "@/lib/server/session";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  return Response.json(await friendsOverview(user.id), { headers: { "Cache-Control": "no-store" } });
}
