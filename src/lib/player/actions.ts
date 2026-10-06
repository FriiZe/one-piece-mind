"use server";

/**
 * Actions du joueur. Chacune peut être appelée directement par une requête :
 * elles vérifient donc toutes la session et ne font confiance à aucun argument.
 */
import type { GameReport } from "@/games/report";
import { SIGNUP_BERRYS } from "@/lib/economy";
import { DEFAULT_LOCALE, isLocale, translator, type Locale } from "@/lib/i18n";
import { accountsEnabled, db } from "@/lib/server/db";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/server/password";
import {
  buyBoosterFor,
  buyCosmeticFor,
  buyRecruitFor,
  equipCosmeticFor,
  applyCrewFor,
  deleteCrewFor,
  openPendingRecruits,
  sanitizeGuestState,
  saveCrewFor,
  sellDuplicatesFor,
  setCrewFor,
  submitGame,
} from "@/lib/server/player";
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
import type { BoosterResult, CosmeticResult, CrewResult, GameResult, RecruitResult, SellResult } from "./types";

const isMode = (value: unknown): value is SpoilerMode => value === "anime" || value === "manga";

/** `lang` : langue dans laquelle la partie a été jouée. */
export async function submitGameAction(report: GameReport, lang: Locale): Promise<GameResult> {
  const user = await currentUser();
  if (!user) return { ok: false, reason: "unavailable" };
  await renewSession();
  return submitGame(user.id, report, undefined, isLocale(lang) ? lang : DEFAULT_LOCALE);
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

/** Garde de côté l'équipage en place, sous ce nom. */
export async function saveCrewAction(name: string): Promise<CrewResult> {
  const user = await currentUser();
  if (!user || typeof name !== "string" || name.length > 200) return { ok: false, reason: "unavailable" };
  return saveCrewFor(user.id, name);
}

/** Remet en place un équipage enregistré (`remove` : le supprime). */
export async function savedCrewAction(crewId: string, remove = false): Promise<CrewResult> {
  const user = await currentUser();
  if (!user || typeof crewId !== "string" || crewId.length > 80) return { ok: false, reason: "unavailable" };
  return remove === true ? deleteCrewFor(user.id, crewId) : applyCrewFor(user.id, crewId);
}

export async function buyCosmeticAction(cosmeticId: string): Promise<CosmeticResult> {
  const user = await currentUser();
  if (!user || typeof cosmeticId !== "string" || cosmeticId.length > 80) return { ok: false, reason: "unavailable" };
  return buyCosmeticFor(user.id, cosmeticId);
}

export async function equipCosmeticAction(slot: string, cosmeticId: string | null): Promise<CosmeticResult> {
  const user = await currentUser();
  if (!user || typeof slot !== "string" || (cosmeticId !== null && (typeof cosmeticId !== "string" || cosmeticId.length > 80))) {
    return { ok: false, reason: "unavailable" };
  }
  return equipCosmeticFor(user.id, slot, cosmeticId);
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

/** Langue du formulaire (champ caché `lang`), pour répondre dans celle du joueur. */
const translatorOf = (form: FormData) => {
  const lang = field(form, "lang");
  return translator(isLocale(lang) ? lang : DEFAULT_LOCALE);
};

export async function signupAction(_: AuthState, form: FormData): Promise<AuthState> {
  const t = translatorOf(form);
  if (!accountsEnabled) return { ok: false, error: t("Les comptes ne sont pas encore ouverts.", "Accounts aren't open yet.") };
  const username = field(form, "username").trim();
  const password = field(form, "password");

  const refuse = (error: string): AuthState => ({ ok: false, error, username });

  if (!USERNAME.test(username)) {
    return refuse(
      t(
        "Le pseudo doit faire 3 à 20 caractères : lettres, chiffres, tiret ou tiret bas.",
        "Your username must be 3 to 20 characters long: letters, digits, hyphen or underscore.",
      ),
    );
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return refuse(
      t(`Le mot de passe doit faire au moins ${PASSWORD_MIN} caractères.`, `Your password must be at least ${PASSWORD_MIN} characters long.`),
    );
  }
  if (!(await allowAttempt(`signup:${await clientAddress()}`, 5, 60 * MINUTE))) {
    return refuse(
      t("Trop de comptes créés depuis cette connexion. Réessaie plus tard.", "Too many accounts created from this connection. Try again later."),
    );
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
        // Cadeau de bienvenue, en plus des Berrys gagnés en invité ; la prime, elle, part de zéro
        berrys: (guest?.berrys ?? 0) + SIGNUP_BERRYS,
        lifetimeBerrys: SIGNUP_BERRYS,
        games: guest?.games ?? 0,
        stats: guest?.stats ?? {},
      },
      select: { id: true },
    });
    // Les recrues gagnées sans compte sont tirées maintenant, par le serveur
    if (guest) await openPendingRecruits(user.id, guest.pendingRecruits, guest.mode);
    await createSession(user.id);
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return refuse(t("Ce pseudo est déjà pris.", "That username is already taken."));
    }
    throw error;
  }
}

export async function loginAction(_: AuthState, form: FormData): Promise<AuthState> {
  const t = translatorOf(form);
  if (!accountsEnabled) return { ok: false, error: t("Les comptes ne sont pas encore ouverts.", "Accounts aren't open yet.") };
  const username = field(form, "username").trim();
  const usernameKey = username.toLowerCase();
  const password = field(form, "password");
  const refused = { ok: false, error: t("Pseudo ou mot de passe incorrect.", "Wrong username or password."), username };
  if (!usernameKey || !password || password.length > PASSWORD_MAX) return refused;

  const accountKey = `login:${usernameKey}`;
  const allowed =
    (await allowAttempt(accountKey, 5, 15 * MINUTE)) && (await allowAttempt(`login-ip:${await clientAddress()}`, 30, 15 * MINUTE));
  if (!allowed) {
    return { ok: false, error: t("Trop de tentatives. Réessaie dans un quart d'heure.", "Too many attempts. Try again in fifteen minutes."), username };
  }

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
