import "server-only";
import { cache } from "react";
import { isAdmin } from "./quizzes";
import { currentUser, type SessionUser } from "./session";

/**
 * L'administrateur connecté, ou `null`. La session n'est lue qu'une fois par
 * requête : les métadonnées d'une page d'administration et la page elle-même
 * posent la même question.
 */
export const currentAdmin = cache(async (): Promise<SessionUser | null> => {
  const user = await currentUser();
  return isAdmin(user) ? user : null;
});
