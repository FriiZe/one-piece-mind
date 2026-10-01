import { accountsEnabled } from "@/lib/server/db";
import { getQuiz } from "@/lib/server/quizzes";
import { currentUser } from "@/lib/server/session";

export async function GET(_request: Request, ctx: RouteContext<"/api/quizzes/[id]">) {
  const headers = { "Cache-Control": "no-store" };
  const { id } = await ctx.params;
  const quiz = accountsEnabled && id.length <= 40 ? await getQuiz(id, await currentUser()) : null;
  if (!quiz) return Response.json({ error: "not-found" }, { status: 404, headers });
  return Response.json(quiz, { headers });
}
