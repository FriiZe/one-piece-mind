import { pollQueue } from "@/lib/server/ranked";
import { currentUser } from "@/lib/server/session";

/** Signe de vie d'un joueur dans la file du classé : il apprend ici qu'un adversaire est trouvé. */
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  return Response.json(await pollQueue(user.id), { headers: { "Cache-Control": "no-store" } });
}
