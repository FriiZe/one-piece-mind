import { accountsEnabled } from "@/lib/server/db";
import { getQuizThumbnail } from "@/lib/server/quizzes";
import { currentUser } from "@/lib/server/session";

/**
 * Vignette d'un quiz de la communauté. Un quiz ne change pas une fois publié, sa vignette non plus :
 * celle d'un quiz public se garde en cache, mais pas trop longtemps, pour qu'un quiz masqué ou
 * supprimé cesse vite d'être servi.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/quizzes/[id]/thumbnail">) {
  const { id } = await ctx.params;
  const thumbnail = accountsEnabled && id.length <= 40 ? await getQuizThumbnail(id, currentUser) : null;
  if (!thumbnail) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": "image/jpeg",
      // L'image vient d'un joueur : le navigateur ne doit pas l'interpréter autrement que comme une image
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": thumbnail.public ? "public, max-age=600" : "private, no-store",
    },
  });
}
