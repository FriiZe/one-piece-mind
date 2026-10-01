import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { accountsEnabled, db } from "./db";

const COOKIE = "opm_session";
const DAY = 86_400_000;
const LIFETIME = 30 * DAY;
/** En deçà, la session est prolongée à la prochaine visite. */
const RENEW_BELOW = 15 * DAY;
/** La dernière visite d'un joueur est notée au plus une fois par tranche de cette durée. */
const SEEN_EVERY = 10 * 60_000;

/** Seule l'empreinte du jeton est enregistrée : une fuite de la base ne donne pas accès aux sessions. */
const sessionId = (token: string) => createHash("sha256").update(token).digest("hex");

async function setCookie(token: string, expires: Date) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LIFETIME);
  // On en profite pour retirer les sessions expirées du joueur
  await db().session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  await db().session.create({ data: { id: sessionId(token), userId, expiresAt } });
  await setCookie(token, expiresAt);
}

export type SessionUser = { id: string; username: string };

/** Joueur connecté d'après le cookie de session, ou `null`. */
export async function currentUser(): Promise<SessionUser | null> {
  if (!accountsEnabled) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const session = await db().session.findUnique({
    where: { id: sessionId(token) },
    select: { id: true, expiresAt: true, user: { select: { id: true, username: true, lastSeenAt: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db().session.deleteMany({ where: { id: session.id } });
    return null;
  }
  const { lastSeenAt, ...user } = session.user;
  // Dernière visite, pour le suivi des joueurs actifs (src/lib/server/admin.ts)
  if (!lastSeenAt || Date.now() - lastSeenAt.getTime() > SEEN_EVERY) {
    await db().user.updateMany({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  }
  return user;
}

/** Prolonge une session proche de sa fin. À appeler là où un cookie peut être écrit (action, route). */
export async function renewSession(): Promise<void> {
  if (!accountsEnabled) return;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return;
  const session = await db().session.findUnique({ where: { id: sessionId(token) }, select: { expiresAt: true } });
  if (!session || session.expiresAt.getTime() - Date.now() > RENEW_BELOW) return;
  const expiresAt = new Date(Date.now() + LIFETIME);
  await db().session.update({ where: { id: sessionId(token) }, data: { expiresAt } });
  await setCookie(token, expiresAt);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token && accountsEnabled) await db().session.deleteMany({ where: { id: sessionId(token) } });
  store.delete(COOKIE);
}

/** Adresse du visiteur, pour limiter les tentatives. Derrière Vercel, elle est dans `x-forwarded-for`. */
export async function clientAddress(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || "local";
}

/**
 * Limite de tentatives : au plus `max` par fenêtre de `windowMs`. Renvoie
 * `false` quand la limite est atteinte. Chaque appel compte pour une tentative.
 */
export async function allowAttempt(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const entry = await db().authThrottle.findUnique({ where: { key } });
  if (!entry || now.getTime() - entry.windowStart.getTime() > windowMs) {
    await db().authThrottle.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    return true;
  }
  if (entry.count >= max) return false;
  await db().authThrottle.update({ where: { key }, data: { count: { increment: 1 } } });
  return true;
}

export async function clearAttempts(key: string): Promise<void> {
  await db().authThrottle.deleteMany({ where: { key } });
}
