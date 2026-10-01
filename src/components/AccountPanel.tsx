"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, Panel } from "@/games/ui/primitives";
import { writeStored } from "@/games/ui/storage";
import { formatNumber } from "@/games/engine/text";
import { EMPTY_PLAYER, SIGNUP_BERRYS } from "@/lib/economy";
import { loginAction, logoutAction, signupAction, type AuthState } from "@/lib/player/actions";
import { usePlayer } from "@/lib/player/PlayerProvider";

const INITIAL: AuthState = { ok: false };
const INPUT =
  "w-full rounded-lg border-2 border-sea-600 bg-sea-900 px-3 py-2.5 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none";

function Credentials({ mode, username }: { mode: "signup" | "login"; username?: string }) {
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-foam">Pseudo</span>
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
          <span className="mt-1 block text-xs text-mist">3 à 20 caractères : lettres, chiffres, tiret ou tiret bas.</span>
        )}
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-foam">Mot de passe</span>
        <input
          name="password"
          type="password"
          required
          minLength={mode === "signup" ? 8 : 1}
          maxLength={200}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className={INPUT}
        />
        {mode === "signup" && <span className="mt-1 block text-xs text-mist">Au moins 8 caractères.</span>}
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
    <form action={action} className="space-y-3">
      <Credentials mode="signup" username={result.username} />
      <input type="hidden" name="guest" value={JSON.stringify(state)} />
      <p className="text-sm text-mist">
        <strong className="text-straw">{formatNumber(SIGNUP_BERRYS)} ฿ offerts</strong> à la création du compte. Ta progression
        actuelle (Berrys, collection, équipage) sera reprise sur ton compte. Sans adresse e-mail, un mot de
        passe oublié ne peut pas être récupéré : note-le bien.
      </p>
      {result.error && (
        <p role="alert" className="font-semibold text-vest">
          {result.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Création…" : "Créer mon compte"}
      </Button>
    </form>
  );
}

function LoginForm() {
  const [result, action, pending] = useActionState(loginAction, INITIAL);

  useEffect(() => {
    if (result.ok) window.location.reload();
  }, [result.ok]);

  return (
    <form action={action} className="space-y-3">
      <Credentials mode="login" username={result.username} />
      {result.error && (
        <p role="alert" className="font-semibold text-vest">
          {result.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
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

  return (
    <section aria-labelledby="compte" className="space-y-3">
      <h2 id="compte" className="font-display text-3xl tracking-wide text-straw">
        Mon compte
      </h2>
      <Panel className="space-y-4">
        {status === "loading" ? (
          <p className="text-mist">Chargement…</p>
        ) : status === "user" ? (
          <>
            <p className="text-mist">
              Connecté en tant que <strong className="text-foam">{username}</strong>. Ta progression est enregistrée sur
              ton compte et te suit d&apos;un appareil à l&apos;autre.
            </p>
            <Button variant="secondary" onClick={logout} disabled={leaving}>
              Me déconnecter
            </Button>
          </>
        ) : !accountsEnabled ? (
          <p className="text-mist">
            Ta progression est gardée dans ce navigateur. Les comptes ne sont pas encore ouverts.
          </p>
        ) : (
          <>
            <p className="text-mist">
              Pour l&apos;instant, ta progression n&apos;existe que dans ce navigateur. Un compte la met à l&apos;abri et
              la rend disponible sur tes autres appareils.
            </p>
            <div role="tablist" aria-label="Compte" className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                    tab === t.id ? "bg-straw text-ink" : "bg-sea-700 text-mist hover:text-foam"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab === "signup" ? <SignupForm /> : <LoginForm />}
          </>
        )}
      </Panel>
    </section>
  );
}
