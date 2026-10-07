"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/games/ui/primitives";
import { readStored, writeStored } from "@/games/ui/storage";
import { formatNumber } from "@/games/engine/text";
import { EMPTY_PLAYER, SIGNUP_BERRYS } from "@/lib/economy";
import { useLocale, useT } from "@/lib/i18n/client";
import { deleteAccountAction, loginAction, logoutAction, signupAction, type AuthState } from "@/lib/player/actions";
import { usePlayer } from "@/lib/player/PlayerProvider";

const INITIAL: AuthState = { ok: false };
const INPUT =
  "h-12 w-full rounded-[10px] border border-sea-600 bg-sea-900 px-3.5 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none";

function Credentials({ mode, username }: { mode: "signup" | "login"; username?: string }) {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      <input type="hidden" name="lang" value={locale} />
      <label className="block">
        <span className="mb-1.5 block text-[15px] font-bold text-foam">{t("Pseudo", "Username")}</span>
        <input
          name="username"
          type="text"
          defaultValue={username}
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_\-]{3,20}"
          autoComplete="username"
          autoCapitalize="off"
          spellCheck={false}
          className={INPUT}
        />
        {mode === "signup" && (
          <span className="mt-1.5 block text-[13px] text-mist">
            {t(
              "3 à 20 caractères : lettres, chiffres, tiret ou tiret bas.",
              "3 to 20 characters: letters, digits, hyphen or underscore.",
            )}
          </span>
        )}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[15px] font-bold text-foam">{t("Mot de passe", "Password")}</span>
        <input
          name="password"
          type="password"
          required
          minLength={mode === "signup" ? 8 : 1}
          maxLength={200}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className={INPUT}
        />
        {mode === "signup" && (
          <span className="mt-1.5 block text-[13px] text-mist">{t("Au moins 8 caractères.", "At least 8 characters.")}</span>
        )}
      </label>
    </>
  );
}

function SignupForm() {
  const { state } = usePlayer();
  const t = useT();
  const locale = useLocale();
  const [result, action, pending] = useActionState(signupAction, INITIAL);

  // Le compte a repris la progression d'invité : on vide celle du navigateur, puis on recharge en tant que joueur connecté
  useEffect(() => {
    if (!result.ok) return;
    writeStored("opm.player", EMPTY_PLAYER);
    writeStored("opm.player.rewarded", []);
    window.location.reload();
  }, [result.ok]);

  return (
    <form action={action} className="space-y-4">
      <Credentials mode="signup" username={result.username} />
      {/* Le mode spoiler aussi : les recrues scellées sont tirées à l'inscription parmi ce que l'invité peut voir */}
      <input type="hidden" name="guest" value={JSON.stringify({ ...state, mode: readStored<string | null>("opm.mode", null) ?? "anime" })} />
      {result.error && (
        <p role="alert" className="font-semibold text-vest">
          {result.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="min-h-[54px] w-full text-[17px]">
        {pending
          ? t("Création…", "Creating…")
          : t(
              `Créer mon compte · ${formatNumber(SIGNUP_BERRYS, locale)} ฿ offerts`,
              `Create my account · ${formatNumber(SIGNUP_BERRYS, locale)} ฿ free`,
            )}
      </Button>
      <p className="text-center text-sm text-mist">
        {t(
          "Un pseudo et un mot de passe, rien d'autre. Sans adresse e-mail, un mot de passe oublié ne peut pas être récupéré : note-le bien.",
          "A username and a password, nothing else. With no email address, a forgotten password can't be recovered: write it down.",
        )}
      </p>
    </form>
  );
}

function LoginForm() {
  const t = useT();
  const [result, action, pending] = useActionState(loginAction, INITIAL);

  useEffect(() => {
    if (result.ok) window.location.reload();
  }, [result.ok]);

  return (
    <form action={action} className="space-y-4">
      <Credentials mode="login" username={result.username} />
      {result.error && (
        <p role="alert" className="font-semibold text-vest">
          {result.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="min-h-[54px] w-full text-[17px]">
        {pending ? t("Connexion…", "Logging in…") : t("Me connecter", "Log in")}
      </Button>
    </form>
  );
}

/** Confirmation de la suppression du compte : ce qui sera perdu, et le mot de passe pour s'en assurer. */
function DeleteAccount({ onClose }: { onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const [result, action, pending] = useActionState(deleteAccountAction, INITIAL);

  // Le compte n'existe plus : la page se recharge en invité
  useEffect(() => {
    if (result.ok) window.location.reload();
  }, [result.ok]);

  return (
    <Modal title={t("Supprimer mon compte", "Delete my account")} onClose={onClose}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="lang" value={locale} />
        <p className="text-foam">
          {t(
            "Ton compte sera supprimé définitivement, avec tout ce qui s'y rattache : Berrys, prime, collection d'avis, équipages, amis, échanges, annonces du marché et quiz que tu as écrits. Rien ne pourra être récupéré.",
            "Your account will be permanently deleted, along with everything attached to it: Berries, bounty, wanted poster collection, crews, friends, trades, market listings and the quizzes you wrote. Nothing can be recovered.",
          )}
        </p>
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-bold text-foam">
            {t("Ton mot de passe, pour confirmer", "Your password, to confirm")}
          </span>
          <input name="password" type="password" required maxLength={200} autoComplete="current-password" autoFocus className={INPUT} />
        </label>
        {result.error && (
          <p role="alert" className="font-semibold text-vest">
            {result.error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="danger" disabled={pending}>
            {pending ? t("Suppression…", "Deleting…") : t("Supprimer définitivement", "Delete permanently")}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t("Annuler", "Cancel")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const TABS = [
  { id: "signup", label: { fr: "Créer un compte", en: "Create an account" } },
  { id: "login", label: { fr: "J'ai déjà un compte", en: "I already have an account" } },
] as const;

export function AccountPanel() {
  const { status, accountsEnabled, username } = usePlayer();
  const t = useT();
  const locale = useLocale();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("signup");
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function logout() {
    setLeaving(true);
    await logoutAction();
    window.location.reload();
  }

  if (status === "loading") return null;

  if (status === "user") {
    return (
      <section aria-labelledby="compte" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sea-700 p-5">
        <div className="min-w-0 flex-1 basis-64">
          <h2 id="compte" className="text-xl font-extrabold text-foam">
            {t("Compte", "Account")}
          </h2>
          <p className="mt-1 text-sm text-mist">
            {t(
              <>
                Connecté en tant que <strong className="text-foam">{username}</strong>. Ta progression te suit d&apos;un appareil à l&apos;autre.
              </>,
              <>
                Logged in as <strong className="text-foam">{username}</strong>. Your progress follows you from one device to the
                next.
              </>,
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={logout} disabled={leaving}>
            {t("Me déconnecter", "Log out")}
          </Button>
          <button
            type="button"
            onClick={() => setDeleting(true)}
            className="cursor-pointer px-2 py-2.5 text-sm font-bold text-vest underline-offset-4 hover:underline"
          >
            {t("Supprimer mon compte", "Delete my account")}
          </button>
        </div>
        {deleting && <DeleteAccount onClose={() => setDeleting(false)} />}
      </section>
    );
  }

  return (
    <section aria-labelledby="compte" className="space-y-5 rounded-[20px] border border-sea-600 bg-sea-800 p-5 sm:p-7">
      <h2 id="compte" className="sr-only">
        {t("Mon compte", "My account")}
      </h2>
      {!accountsEnabled ? (
        <p className="text-mist">
          {t(
            "Ta progression est gardée dans ce navigateur. Les comptes ne sont pas encore ouverts.",
            "Your progress is saved in this browser. Accounts aren't open yet.",
          )}
        </p>
      ) : (
        <>
          <div role="tablist" aria-label={t("Compte", "Account")} className="grid grid-cols-2 rounded-xl bg-sea-900 p-1 text-sm font-extrabold sm:text-[15px]">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                onClick={() => setTab(entry.id)}
                className={`min-h-11 cursor-pointer rounded-[9px] px-2 transition-colors ${tab === entry.id ? "bg-straw text-ink" : "text-mist hover:text-foam"}`}
              >
                {entry.label[locale]}
              </button>
            ))}
          </div>
          {tab === "signup" ? <SignupForm /> : <LoginForm />}
        </>
      )}
    </section>
  );
}
