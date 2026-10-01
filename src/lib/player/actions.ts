"use server";

/**
 * Actions du joueur. Chacune peut être appelée directement par une requête :
 * elles vérifient donc toutes la session et ne font confiance à aucun argument.
 */
import type { GameReport } from "@/games/report";
import { SIGNUP_BERRYS } from "@/lib/economy";
import { accountsEnabled, db } from "@/lib/server/db";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/server/password";
import { buyBoosterFor, buyRecruitFor, sanitizeGuestState, sellDuplicatesFor, setCrewFor, submitGame } from "@/lib/server/player";
import {
  allowAttempt,
  clearAttempts,
  clientAddress,
  createSession,
  currentUser,
  destroySession,
  renewSession,
} from "@/lib/server/session";
import type { SpoilerMode } from "@/lib/spoilers";
import { Prisma } from "@/generated/prisma/client";
import type { BoosterResult, CrewResult, GameResult, RecruitResult, SellResult } from "./types";

const isMode = (value: unknown): value is SpoilerMode => value === "anime" || value === "manga";

export async function submitGameAction(report: GameReport): Promise<GameResult> {
  const user = await currentUser();
  if (!user) return { ok: false, reason: "unavailable" };
  await renewSession();
  return submitGame(user.id, report);
}

export async function buyRecruitAction(mode: SpoilerMode): Promise<RecruitResult> {
  const user = await currentUser();
  if (!user || !isMode(mode)) return { ok: false, reason: "unavailable" };
  return buyRecruitFor(user.id, mode);
}

export async function buyBoosterAction(mode: SpoilerMode): Promise<BoosterResult> {
  const user = await currentUser();
  if (!user || !isMode(mode)) return { ok: false, reason: "unavailable" };
  return buyBoosterFor(user.id, mode);
}

export async function sellDuplicatesAction(mode: SpoilerMode, characterId: string | null): Promise<SellResult> {
  const user = await currentUser();
  if (!user || !isMode(mode) || (characterId !== null && (typeof characterId !== "string" || characterId.length > 80))) {
    return { ok: false, reason: "unavailable" };
  }
  return sellDuplicatesFor(user.id, mode, characterId);
}

export async function setCrewAction(post: string, characterId: string | null): Promise<CrewResult> {
  const user = await currentUser();
  if (!user || typeof post !== "string" || (characterId !== null && typeof characterId !== "string")) {
    return { ok: false, reason: "unavailable" };
  }
  return setCrewFor(user.id, post, characterId);
}

// ---------------------------------------------------------------------------
// Comptes

/** `username` : le pseudo saisi, rendu au formulaire pour qu'il ne soit pas à retaper après une erreur. */
export type AuthState = { ok: boolean; error?: string; username?: string };

const USERNAME = /^[A-Za-z0-9_-]{3,20}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;
const MINUTE = 60_000;

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

export async function signupAction(_: AuthState, form: FormData): Promise<AuthState> {
  if (!accountsEnabled) return { ok: false, error: "Les comptes ne sont pas encore ouverts." };
  const username = field(form, "username").trim();
  const password = field(form, "password");

  const refuse = (error: string): AuthState => ({ ok: false, error, username });

  if (!USERNAME.test(username)) {
    return refuse("Le pseudo doit faire 3 à 20 caractères : lettres, chiffres, tiret ou tiret bas.");
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return refuse(`Le mot de passe doit faire au moins ${PASSWORD_MIN} caractères.`);
  }
  if (!(await allowAttempt(`signup:${await clientAddress()}`, 5, 60 * MINUTE))) {
    return refuse("Trop de comptes créés depuis cette connexion. Réessaie plus tard.");
  }

  // La progression d'invité, gardée dans le navigateur, est reprise à la création du compte
  let guest: ReturnType<typeof sanitizeGuestState> = null;
  try {
    guest = sanitizeGuestState(JSON.parse(field(form, "guest") || "null"));
  } catch {
    guest = null;
  }

  try {
    const user = await db().user.create({
      data: {
        username,
        usernameKey: username.toLowerCase(),
        passwordHash: await hashPassword(password),
        // Cadeau de bienvenue, en plus de la progression d'invité reprise
        berrys: (guest?.berrys ?? 0) + SIGNUP_BERRYS,
        lifetimeBerrys: (guest?.lifetimeBerrys ?? 0) + SIGNUP_BERRYS,
        games: guest?.games ?? 0,
        stats: guest?.stats ?? {},
        collection: guest ? { create: guest.collection } : undefined,
        crew: guest ? { create: guest.crew } : undefined,
      },
      select: { id: true },
    });
    await createSession(user.id);
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return refuse("Ce pseudo est déjà pris.");
    }
    throw error;
  }
}

export async function loginAction(_: AuthState, form: FormData): Promise<AuthState> {
  if (!accountsEnabled) return { ok: false, error: "Les comptes ne sont pas encore ouverts." };
  const username = field(form, "username").trim();
  const usernameKey = username.toLowerCase();
  const password = field(form, "password");
  const refused = { ok: false, error: "Pseudo ou mot de passe incorrect.", username };
  if (!usernameKey || !password || password.length > PASSWORD_MAX) return refused;

  const accountKey = `login:${usernameKey}`;
  const allowed =
    (await allowAttempt(accountKey, 5, 15 * MINUTE)) && (await allowAttempt(`login-ip:${await clientAddress()}`, 30, 15 * MINUTE));
  if (!allowed) return { ok: false, error: "Trop de tentatives. Réessaie dans un quart d'heure.", username };

  const user = await db().user.findUnique({ where: { usernameKey }, select: { id: true, passwordHash: true } });
  // Le calcul a lieu même sans compte : le temps de réponse ne dit pas si le pseudo existe
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return refused;

  await clearAttempts(accountKey);
  await createSession(user.id);
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
}
