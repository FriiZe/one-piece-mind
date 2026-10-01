import { pendingCounts } from "@/lib/server/friends";
import { isAdmin } from "@/lib/server/quizzes";
import { currentUser } from "@/lib/server/session";

/** Ce qui attend le joueur connecté : demandes d'ami, invitations, quiz à relire. */
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  return Response.json(await pendingCounts(user.id, isAdmin(user)), { headers: { "Cache-Control": "no-store" } });
}
