"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/games/ui/primitives";
import { writeStored } from "@/games/ui/storage";
import { formatNumber } from "@/games/engine/text";
import { EMPTY_PLAYER, SIGNUP_BERRYS } from "@/lib/economy";
import { loginAction, logoutAction, signupAction, type AuthState } from "@/lib/player/actions";
import { usePlayer } from "@/lib/player/PlayerProvider";

const INITIAL: AuthState = { ok: false };
const INPUT =
  "h-12 w-full rounded-[10px] border border-sea-600 bg-sea-900 px-3.5 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none";

function Credentials({ mode, username }: { mode: "signup" | "login"; username?: string }) {
  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-[15px] font-bold text-foam">Pseudo</span>
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
          <span className="mt-1.5 block text-[13px] text-mist">3 à 20 caractères : lettres, chiffres, tiret ou tiret bas.</span>
        )}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[15px] font-bold text-foam">Mot de passe</span>
        <input
          name="password"
          type="password"
          required
          minLength={mode === "signup" ? 8 : 1}
          maxLength={200}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className={INPUT}
        />
        {mode === "signup" && <span className="mt-1.5 block text-[13px] text-mist">Au moins 8 caractères.</span>}
      </label>
    </>
  );
}

function SignupForm() {
  const { state } = usePlayer();
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
      <input type="hidden" name="guest" value={JSON.stringify(state)} />
      {result.error && (
        <p role="alert" className="font-semibold text-vest">
          {result.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="min-h-[54px] w-full text-[17px]">
        {pending ? "Création…" : `Créer mon compte · ${formatNumber(SIGNUP_BERRYS)} ฿ offerts`}
      </Button>
      <p className="text-center text-sm text-mist">
        Un pseudo et un mot de passe, rien d&apos;autre. Sans adresse e-mail, un mot de passe oublié ne peut pas être récupéré : note-le
        bien.
      </p>
    </form>
  );
}

function LoginForm() {
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
        {pending ? "Connexion…" : "Me connecter"}
      </Button>
    </form>
  );
}

const TABS = [
  { id: "signup", label: "Créer un compte" },
  { id: "login", label: "J'ai déjà un compte" },
] as const;

export function AccountPanel() {
  const { status, accountsEnabled, username } = usePlayer();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("signup");
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await logoutAction();
    window.location.reload();
  }

  if (status === "loading") return null;

  if (status === "user") {
    return (
      <section aria-labelledby="compte" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sea-700 p-5">
        <div className="min-w-0 flex-1">
          <h2 id="compte" className="text-xl font-extrabold text-foam">
            Compte
          </h2>
          <p className="mt-1 text-sm text-mist">
            Connecté en tant que <strong className="text-foam">{username}</strong>. Ta progression te suit d&apos;un appareil à l&apos;autre.
          </p>
        </div>
        <Button variant="secondary" onClick={logout} disabled={leaving}>
          Me déconnecter
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="compte" className="space-y-5 rounded-[20px] border border-sea-600 bg-sea-800 p-5 sm:p-7">
      <h2 id="compte" className="sr-only">
        Mon compte
      </h2>
      {!accountsEnabled ? (
        <p className="text-mist">Ta progression est gardée dans ce navigateur. Les comptes ne sont pas encore ouverts.</p>
      ) : (
        <>
          <div role="tablist" aria-label="Compte" className="grid grid-cols-2 rounded-xl bg-sea-900 p-1 text-sm font-extrabold sm:text-[15px]">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`min-h-11 cursor-pointer rounded-[9px] px-2 transition-colors ${tab === t.id ? "bg-straw text-ink" : "text-mist hover:text-foam"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "signup" ? <SignupForm /> : <LoginForm />}
        </>
      )}
    </section>
  );
}
