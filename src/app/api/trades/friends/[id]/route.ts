import { currentUser } from "@/lib/server/session";
import { friendCollection } from "@/lib/server/trades";

/** Collection d'un ami, pour lui proposer un échange. Refusée à qui n'est pas son ami. */
export async function GET(_request: Request, ctx: RouteContext<"/api/trades/friends/[id]">) {
  const headers = { "Cache-Control": "no-store" };
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401, headers });
  const { id } = await ctx.params;
  const collection = id.length <= 80 ? await friendCollection(user.id, id) : null;
  if (!collection) return Response.json({ error: "not-found" }, { status: 404, headers });
  return Response.json(collection, { headers });
}
