"use server";

/** Actions sur les quiz de la communauté. Chacune vérifie la session : elles peuvent être appelées directement. */
import type { QuizPlayResult, QuizResult } from "@/lib/quiz/types";
import { createQuiz, deleteQuiz, reportQuiz, restoreQuiz, submitQuizPlay } from "@/lib/server/quizzes";
import { allowAttempt, currentUser } from "@/lib/server/session";
import { Prisma } from "@/generated/prisma/client";

const UNAVAILABLE = { ok: false, error: "unavailable" } as const;
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 40;
const HOUR = 3_600_000;

export async function createQuizAction(input: unknown): Promise<QuizResult<{ id: string }>> {
  const user = await currentUser();
  if (!user) return UNAVAILABLE;
  return createQuiz(user, input);
}

export async function deleteQuizAction(id: string): Promise<QuizResult> {
  const user = await currentUser();
  if (!user || !isId(id)) return UNAVAILABLE;
  return deleteQuiz(user, id);
}

export async function reportQuizAction(id: string, reason: string): Promise<QuizResult<{ hidden: boolean }>> {
  const user = await currentUser();
  if (!user || !isId(id) || typeof reason !== "string") return UNAVAILABLE;
  // Un compte ne peut pas signaler à la chaîne
  if (!(await allowAttempt(`quiz-report:${user.id}`, 20, 24 * HOUR))) return { ok: false, error: "limit" };
  return reportQuiz(user, id, reason);
}

export async function restoreQuizAction(id: string): Promise<QuizResult> {
  const user = await currentUser();
  if (!user || !isId(id)) return UNAVAILABLE;
  return restoreQuiz(user, id);
}

export async function submitQuizAction(id: string, answers: unknown): Promise<QuizResult<{ result: QuizPlayResult }>> {
  const user = await currentUser();
  if (!user || !isId(id)) return UNAVAILABLE;
  try {
    return await submitQuizPlay(user, id, answers);
  } catch (error) {
    // Deux envois simultanés de la même partie : le second est refusé par la base
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, error: "already" };
    throw error;
  }
}
