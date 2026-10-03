import "server-only";
import { dailyKey } from "@/games/engine/daily";
import { DAILY_BERRY_CAP } from "@/lib/economy";
import {
  COMMUNITY_REWARDS_PER_DAY,
  communityBerrys,
  QUIZ_LIMITS,
  QUIZ_THUMBNAIL,
  quizAnswersSchema,
  quizDraftSchema,
  quizInputSchema,
  quizQuestionsSchema,
  REPORTS_TO_HIDE,
  scoreQuiz,
  type QuizDraft,
  type QuizQuestion,
} from "@/lib/quiz/rules";
import type { QuizDetail, QuizDraftSummary, QuizList, QuizPlayResult, QuizResult, QuizSummary } from "@/lib/quiz/types";
import type { Locale } from "@/lib/i18n";
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
  language: true,
  questions: true,
  status: true,
  plays: true,
  createdAt: true,
  authorId: true,
  author: { select: { username: true } },
  // Sa seule présence suffit : l'image n'est lue que par la route qui la sert
  thumbnail: { select: { quizId: true } },
  _count: { select: { reports: true } },
} satisfies Prisma.QuizSelect;
type QuizRow = Prisma.QuizGetPayload<{ select: typeof summarySelect }>;

function toSummary(row: QuizRow, best: Map<string, { score: number; max: number }>, withReports: boolean): QuizSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    spoiler: row.spoiler as SpoilerMode,
    language: row.language === "en" ? "en" : "fr",
    hasThumbnail: !!row.thumbnail,
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

/**
 * Quiz publics, les plus récents ou les plus joués d'abord, et ceux du joueur connecté.
 * `language` ne garde, parmi les quiz publics, que ceux rédigés dans cette langue.
 */
export async function listQuizzes(user: SessionUser | null, sort: "recent" | "top", language: Locale | null = null): Promise<QuizList> {
  const admin = isAdmin(user);
  const [publicRows, mineRows, hiddenRows, drafts] = await Promise.all([
    db().quiz.findMany({
      where: { status: "public", ...(language ? { language } : {}) },
      orderBy: sort === "top" ? [{ plays: "desc" }, { createdAt: "desc" }] : { createdAt: "desc" },
      take: LIST_SIZE,
      select: summarySelect,
    }),
    user ? db().quiz.findMany({ where: { authorId: user.id }, orderBy: { createdAt: "desc" }, select: summarySelect }) : [],
    admin ? db().quiz.findMany({ where: { status: "hidden" }, orderBy: { createdAt: "desc" }, take: LIST_SIZE, select: summarySelect }) : [],
    user ? listQuizDrafts(user) : [],
  ]);
  const best = await bestScores(user?.id, [...publicRows, ...mineRows, ...hiddenRows].map((row) => row.id));
  return {
    enabled: true,
    quizzes: publicRows.map((row) => toSummary(row, best, admin)),
    mine: mineRows.map((row) => toSummary(row, best, true)),
    drafts,
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

/** Brouillons d'un joueur, le plus récemment enregistré d'abord. */
async function listQuizDrafts(user: SessionUser): Promise<QuizDraftSummary[]> {
  const rows = await db().quizDraft.findMany({ where: { authorId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, data: true, updatedAt: true } });
  return rows.flatMap((row) => {
    // Colonne JSON : on ne se fie à son contenu qu'après validation
    const draft = quizDraftSchema.safeParse(row.data);
    return draft.success
      ? [{ id: row.id, title: draft.data.title.trim(), questionCount: draft.data.questions.length, updatedAt: row.updatedAt.getTime() }]
      : [];
  });
}

/** Un brouillon du joueur, pour le reprendre dans le formulaire. */
export async function getQuizDraft(user: SessionUser, id: string): Promise<QuizResult<{ draft: QuizDraft }>> {
  const row = await db().quizDraft.findFirst({ where: { id, authorId: user.id }, select: { data: true } });
  const draft = row && quizDraftSchema.safeParse(row.data);
  return draft?.success ? { ok: true, draft: draft.data } : { ok: false, error: "not-found" };
}

/**
 * Enregistre le formulaire comme brouillon dans le compte du joueur : un nouveau, ou la mise à jour
 * de `id`. Un brouillon supprimé entre-temps est recréé plutôt que perdu.
 */
export async function saveQuizDraft(user: SessionUser, id: string | null, input: unknown): Promise<QuizResult<{ id: string }>> {
  const parsed = quizDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (parsed.data.thumbnail && !decodeThumbnail(parsed.data.thumbnail)) return { ok: false, error: "invalid" };

  if (id) {
    const updated = await db().quizDraft.updateMany({ where: { id, authorId: user.id }, data: { data: parsed.data } });
    if (updated.count > 0) return { ok: true, id };
  }
  if ((await db().quizDraft.count({ where: { authorId: user.id } })) >= QUIZ_LIMITS.drafts) return { ok: false, error: "drafts" };
  const draft = await db().quizDraft.create({ data: { authorId: user.id, data: parsed.data }, select: { id: true } });
  return { ok: true, id: draft.id };
}

export async function deleteQuizDraft(user: SessionUser, id: string): Promise<QuizResult> {
  const deleted = await db().quizDraft.deleteMany({ where: { id, authorId: user.id } });
  return deleted.count > 0 ? { ok: true } : { ok: false, error: "not-found" };
}

/** Publie un quiz. `draftId` : le brouillon dont il vient, supprimé une fois le quiz en ligne. */
export async function createQuiz(user: SessionUser, input: unknown, draftId: string | null = null): Promise<QuizResult<{ id: string }>> {
  const parsed = quizInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const [online, today] = await Promise.all([
    db().quiz.count({ where: { authorId: user.id } }),
    db().quiz.count({ where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - DAY) } } }),
  ]);
  if (online >= QUIZ_LIMITS.perAuthor || today >= QUIZ_LIMITS.perDay) return { ok: false, error: "limit" };

  const { thumbnail, ...fields } = parsed.data;
  const image = thumbnail ? decodeThumbnail(thumbnail) : null;
  if (thumbnail && !image) return { ok: false, error: "invalid" };

  const quiz = await db().quiz.create({
    data: { authorId: user.id, ...fields, ...(image ? { thumbnail: { create: { data: image } } } : {}) },
    select: { id: true },
  });
  if (draftId) await db().quizDraft.deleteMany({ where: { id: draftId, authorId: user.id } });
  return { ok: true, id: quiz.id };
}

/**
 * Octets d'une vignette envoyée en URL de données ; `null` si ce n'est pas un JPEG de taille
 * raisonnable. On ne se fie pas au type annoncé : le fichier doit commencer et finir comme un JPEG.
 */
function decodeThumbnail(dataUrl: string): Uint8Array<ArrayBuffer> | null {
  const bytes = new Uint8Array(Buffer.from(dataUrl.slice(QUIZ_THUMBNAIL.prefix.length), "base64"));
  const jpeg = bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  return jpeg && bytes.length <= QUIZ_THUMBNAIL.maxBytes ? bytes : null;
}

/** Vignette d'un quiz. Celle d'un quiz masqué n'est rendue qu'à son auteur et aux administrateurs. */
export async function getQuizThumbnail(
  id: string,
  currentUser: () => Promise<SessionUser | null>,
): Promise<{ data: Uint8Array<ArrayBuffer>; public: boolean } | null> {
  const row = await db().quizThumbnail.findUnique({ where: { quizId: id }, select: { data: true, quiz: { select: { status: true, authorId: true } } } });
  if (!row) return null;
  if (row.quiz.status === "public") return { data: row.data, public: true };
  // La session n'est lue que pour un quiz masqué : la vignette d'un quiz public se sert sans elle
  const user = await currentUser();
  return user && (row.quiz.authorId === user.id || isAdmin(user)) ? { data: row.data, public: false } : null;
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
