import "server-only";
import { dailyKey } from "@/games/engine/daily";
import { DAILY_BERRY_CAP } from "@/lib/economy";
import {
  COMMUNITY_REWARDS_PER_DAY,
  communityBerrys,
  QUIZ_LIMITS,
  quizAnswersSchema,
  quizInputSchema,
  quizQuestionsSchema,
  REPORTS_TO_HIDE,
  scoreQuiz,
  type QuizQuestion,
} from "@/lib/quiz/rules";
import type { QuizDetail, QuizList, QuizPlayResult, QuizResult, QuizSummary } from "@/lib/quiz/types";
import type { SpoilerMode } from "@/lib/spoilers";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { notify } from "./push";
import type { SessionUser } from "./session";

const LIST_SIZE = 60;
const DAY = 86_400_000;

/** Administrateurs : pseudos listés dans `ADMIN_USERNAMES`, séparés par des virgules. */
const adminNames = () =>
  (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

export function isAdmin(user: SessionUser | null): boolean {
  return !!user && adminNames().includes(user.username.toLowerCase());
}

const summarySelect = {
  id: true,
  title: true,
  description: true,
  spoiler: true,
  questions: true,
  status: true,
  plays: true,
  createdAt: true,
  authorId: true,
  author: { select: { username: true } },
  _count: { select: { reports: true } },
} satisfies Prisma.QuizSelect;
type QuizRow = Prisma.QuizGetPayload<{ select: typeof summarySelect }>;

function toSummary(row: QuizRow, best: Map<string, { score: number; max: number }>, withReports: boolean): QuizSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    spoiler: row.spoiler as SpoilerMode,
    author: row.author.username,
    questionCount: Array.isArray(row.questions) ? row.questions.length : 0,
    plays: row.plays,
    createdAt: row.createdAt.getTime(),
    status: row.status === "hidden" ? "hidden" : "public",
    ...(withReports ? { reports: row._count.reports } : {}),
    yourBest: best.get(row.id) ?? null,
  };
}

async function bestScores(userId: string | undefined, quizIds: string[]) {
  if (!userId || !quizIds.length) return new Map<string, { score: number; max: number }>();
  const plays = await db().quizPlay.findMany({
    where: { userId, quizId: { in: quizIds } },
    select: { quizId: true, score: true, maxScore: true },
  });
  return new Map(plays.map((play) => [play.quizId, { score: play.score, max: play.maxScore }]));
}

/** Quiz publics, les plus récents ou les plus joués d'abord, et ceux du joueur connecté. */
export async function listQuizzes(user: SessionUser | null, sort: "recent" | "top"): Promise<QuizList> {
  const admin = isAdmin(user);
  const [publicRows, mineRows, hiddenRows] = await Promise.all([
    db().quiz.findMany({
      where: { status: "public" },
      orderBy: sort === "top" ? [{ plays: "desc" }, { createdAt: "desc" }] : { createdAt: "desc" },
      take: LIST_SIZE,
      select: summarySelect,
    }),
    user ? db().quiz.findMany({ where: { authorId: user.id }, orderBy: { createdAt: "desc" }, select: summarySelect }) : [],
    admin ? db().quiz.findMany({ where: { status: "hidden" }, orderBy: { createdAt: "desc" }, take: LIST_SIZE, select: summarySelect }) : [],
  ]);
  const best = await bestScores(user?.id, [...publicRows, ...mineRows, ...hiddenRows].map((row) => row.id));
  return {
    enabled: true,
    quizzes: publicRows.map((row) => toSummary(row, best, admin)),
    mine: mineRows.map((row) => toSummary(row, best, true)),
    hidden: hiddenRows.map((row) => toSummary(row, best, true)),
    isAdmin: admin,
  };
}

/** Un quiz et ses questions. Un quiz masqué n'est rendu qu'à son auteur et aux administrateurs. */
export async function getQuiz(id: string, user: SessionUser | null): Promise<QuizDetail | null> {
  const row = await db().quiz.findUnique({ where: { id }, select: summarySelect });
  if (!row) return null;
  const admin = isAdmin(user);
  const isAuthor = !!user && row.authorId === user.id;
  if (row.status !== "public" && !isAuthor && !admin) return null;

  // Colonne JSON : on ne se fie à son contenu qu'après validation
  const questions = quizQuestionsSchema.safeParse(row.questions);
  if (!questions.success) return null;

  const [best, report] = await Promise.all([
    bestScores(user?.id, [row.id]),
    user ? db().quizReport.findUnique({ where: { quizId_userId: { quizId: row.id, userId: user.id } }, select: { quizId: true } }) : null,
  ]);
  return {
    ...toSummary(row, best, isAuthor || admin),
    questions: questions.data,
    isAuthor,
    canDelete: isAuthor || admin,
    isAdmin: admin,
    reported: !!report,
  };
}

export async function createQuiz(user: SessionUser, input: unknown): Promise<QuizResult<{ id: string }>> {
  const parsed = quizInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const [online, today] = await Promise.all([
    db().quiz.count({ where: { authorId: user.id } }),
    db().quiz.count({ where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - DAY) } } }),
  ]);
  if (online >= QUIZ_LIMITS.perAuthor || today >= QUIZ_LIMITS.perDay) return { ok: false, error: "limit" };

  const quiz = await db().quiz.create({
    data: { authorId: user.id, ...parsed.data },
    select: { id: true },
  });
  return { ok: true, id: quiz.id };
}

export async function deleteQuiz(user: SessionUser, id: string): Promise<QuizResult> {
  const quiz = await db().quiz.findUnique({ where: { id }, select: { authorId: true } });
  if (!quiz) return { ok: false, error: "not-found" };
  if (quiz.authorId !== user.id && !isAdmin(user)) return { ok: false, error: "forbidden" };
  await db().quiz.deleteMany({ where: { id } });
  return { ok: true };
}

/** Signale un quiz. Au bout de `REPORTS_TO_HIDE` signalements, il est masqué jusqu'à relecture. */
export async function reportQuiz(user: SessionUser, id: string, reason: string): Promise<QuizResult<{ hidden: boolean }>> {
  const quiz = await db().quiz.findUnique({ where: { id }, select: { authorId: true, title: true, status: true, reviewedAt: true } });
  if (!quiz || quiz.status !== "public") return { ok: false, error: "not-found" };
  if (quiz.authorId === user.id) return { ok: false, error: "own" };

  try {
    await db().quizReport.create({ data: { quizId: id, userId: user.id, reason: reason.slice(0, 200) } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, error: "already" };
    throw error;
  }
  // Un quiz déjà relu par un administrateur n'est plus masqué automatiquement
  const reports = await db().quizReport.count({ where: { quizId: id } });
  const hidden = reports >= REPORTS_TO_HIDE && !quiz.reviewedAt;
  if (hidden) {
    const masked = await db().quiz.updateMany({ where: { id, status: "public" }, data: { status: "hidden" } });
    // Deux signalements simultanés ne préviennent les administrateurs qu'une fois
    if (masked.count > 0) {
      const admins = await db().user.findMany({ where: { usernameKey: { in: adminNames() } }, select: { id: true } });
      await Promise.all(admins.map((admin) => notify(admin.id, { type: "quiz-hidden", title: quiz.title })));
    }
  }
  return { ok: true, hidden };
}

/** Remet en ligne un quiz masqué, après relecture par un administrateur. */
export async function restoreQuiz(user: SessionUser, id: string): Promise<QuizResult> {
  if (!isAdmin(user)) return { ok: false, error: "forbidden" };
  const restored = await db().quiz.updateMany({ where: { id }, data: { status: "public", reviewedAt: new Date() } });
  if (restored.count === 0) return { ok: false, error: "not-found" };
  await db().quizReport.deleteMany({ where: { quizId: id } });
  return { ok: true };
}

/**
 * Enregistre une partie terminée. Le score est recalculé ici à partir des
 * réponses. Seule la première partie d'un joueur sur un quiz qu'il n'a pas
 * écrit rapporte des Berrys, dans la limite du plafond journalier.
 */
export async function submitQuizPlay(user: SessionUser, id: string, input: unknown): Promise<QuizResult<{ result: QuizPlayResult }>> {
  const answers = quizAnswersSchema.safeParse(input);
  if (!answers.success) return { ok: false, error: "invalid" };

  const quiz = await db().quiz.findUnique({ where: { id }, select: { authorId: true, status: true, questions: true } });
  if (!quiz) return { ok: false, error: "not-found" };
  const own = quiz.authorId === user.id;
  if (quiz.status !== "public" && !own && !isAdmin(user)) return { ok: false, error: "not-found" };
  const questions = quizQuestionsSchema.safeParse(quiz.questions);
  if (!questions.success) return { ok: false, error: "not-found" };

  const { score, max } = scoreQuiz(questions.data as QuizQuestion[], answers.data);
  const today = dailyKey();

  const result = await db().$transaction(async (tx): Promise<QuizPlayResult> => {
    const previous = await tx.quizPlay.findUnique({ where: { quizId_userId: { quizId: id, userId: user.id } } });
    if (previous) {
      const best = Math.max(previous.score, score);
      if (best > previous.score) {
        await tx.quizPlay.update({ where: { quizId_userId: { quizId: id, userId: user.id } }, data: { score: best, maxScore: max } });
      }
      return { score, max, best, berrys: 0, reward: own ? "own" : "already" };
    }

    let berrys = 0;
    let reward: QuizPlayResult["reward"] = own ? "own" : "paid";
    if (!own) {
      const rewarded = await tx.quizPlay.count({
        where: { userId: user.id, berrys: { gt: 0 }, createdAt: { gte: new Date(Date.now() - DAY) } },
      });
      if (rewarded >= COMMUNITY_REWARDS_PER_DAY) reward = "limit";
      else {
        const player = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { dayKey: true, dayEarned: true } });
        const earnedToday = player.dayKey === today ? player.dayEarned : 0;
        berrys = Math.max(0, Math.min(communityBerrys(score, max), DAILY_BERRY_CAP - earnedToday));
        await tx.user.update({
          where: { id: user.id },
          data: {
            berrys: { increment: berrys },
            lifetimeBerrys: { increment: berrys },
            games: { increment: 1 },
            dayKey: today,
            dayEarned: earnedToday + berrys,
            // Premier gain de la journée : les jeux du jour validés la veille ne comptent plus
            ...(player.dayKey === today ? {} : { dayDone: [] }),
          },
        });
      }
    }
    // La clé (quiz, joueur) fait échouer la transaction si deux envois arrivent en même temps
    await tx.quizPlay.create({ data: { quizId: id, userId: user.id, score, maxScore: max, berrys } });
    if (!own) await tx.quiz.update({ where: { id }, data: { plays: { increment: 1 } } });
    return { score, max, best: score, berrys, reward };
  });
  return { ok: true, result };
}
