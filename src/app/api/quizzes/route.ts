import type { QuizList } from "@/lib/quiz/types";
import { accountsEnabled } from "@/lib/server/db";
import { listQuizzes } from "@/lib/server/quizzes";
import { currentUser } from "@/lib/server/session";

const CLOSED: QuizList = { enabled: false, quizzes: [], mine: [], hidden: [], isAdmin: false };

/** Quiz de la communauté. `?sort=top` : les plus joués d'abord, sinon les plus récents. */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!accountsEnabled) return Response.json(CLOSED, { headers });
  const sort = new URL(request.url).searchParams.get("sort") === "top" ? "top" : "recent";
  return Response.json(await listQuizzes(await currentUser(), sort), { headers });
}
