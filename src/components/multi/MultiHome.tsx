"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DIFFICULTIES, type Difficulty } from "@/games/engine/difficulty";
import { MIX_SLUGS, type MixSlug } from "@/games/qcm/logic";
import { Button, Panel } from "@/games/ui/primitives";
import { useStored } from "@/games/ui/storage";
import { getGame } from "@/lib/games/catalog";
import { createRoomRequest, ROOM_ERRORS, saveTicket, useFriends } from "@/lib/multi/client";
import { ANSWER_SECONDS, CODE_LENGTH, DEFAULT_SETTINGS, MAX_PLAYERS, normalizeCode, QUESTION_COUNTS } from "@/lib/multi/rules";
import { usePlayer } from "@/lib/player/PlayerProvider";
import type { SpoilerMode } from "@/lib/spoilers";

const INPUT =
  "h-12 w-full rounded-[10px] border border-sea-600 bg-sea-900 px-3.5 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none";

const LEGEND = "mb-2 text-xs font-extrabold tracking-[0.15em] text-mist uppercase";

function Choice<T extends string | number>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className={LEGEND}>{legend}</legend>
      <div className="grid rounded-xl bg-sea-900 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex min-h-11 cursor-pointer items-center justify-center rounded-[9px] text-[15px] font-extrabold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-straw ${
              value === option.value ? "bg-sea-700 text-foam" : "text-mist hover:text-foam"
            }`}
          >
            <input
              type="radio"
              name={legend}
              className="sr-only"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CreateRoom() {
  const router = useRouter();
  const { status } = usePlayer();
  const [storedMode] = useStored<SpoilerMode | null>("opm.mode", null);
  const [mode, setMode] = useState<SpoilerMode | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [games, setGames] = useState<MixSlug[]>([...MIX_SLUGS]);
  const [questionCount, setQuestionCount] = useState<number>(DEFAULT_SETTINGS.questionCount);
  const [seconds, setSeconds] = useState<number>(DEFAULT_SETTINGS.seconds);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Le mode du salon reprend par défaut celui du joueur ; à défaut, le mode anime, qui ne révèle rien
  const chosenMode = mode ?? storedMode ?? "anime";

  function toggle(slug: MixSlug) {
    setGames((current) => (current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug]));
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createRoomRequest(
      { mode: chosenMode, difficulty, games, questionCount, seconds },
      status === "user" ? undefined : name,
    );
    if (!result.ok) {
      setBusy(false);
      setError(ROOM_ERRORS[result.error]);
      return;
    }
    saveTicket(result.ticket);
    router.push(`/multi/${result.ticket.code}`);
  }

  return (
    <form onSubmit={create} className="space-y-5 rounded-[20px] border-2 border-straw bg-straw/5 p-5 sm:p-6">
      <h2 className="text-xl font-extrabold text-foam">Créer un salon</h2>
      {status !== "user" && (
        <label className="block max-w-sm">
          <span className={`block ${LEGEND}`}>Ton pseudo</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={16}
            autoComplete="nickname"
            className={INPUT}
          />
        </label>
      )}

      <fieldset>
        <legend className={LEGEND}>
          Jeux tirés au sort · {games.length} choisi{games.length > 1 ? "s" : ""}
        </legend>
        <div className="flex flex-wrap gap-2">
          {MIX_SLUGS.map((slug) => {
            const checked = games.includes(slug);
            return (
              <label
                key={slug}
                className={`flex min-h-11 cursor-pointer items-center rounded-full px-3.5 text-sm font-bold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-straw ${
                  checked ? "bg-straw text-ink" : "border border-sea-600 text-mist hover:text-foam"
                }`}
              >
                <input type="checkbox" checked={checked} onChange={() => toggle(slug)} className="sr-only" />
                {getGame(slug)?.title ?? slug}
              </label>
            );
          })}
          {games.length < MIX_SLUGS.length && (
            <button
              type="button"
              onClick={() => setGames([...MIX_SLUGS])}
              className="min-h-11 cursor-pointer px-2 text-sm font-bold text-straw underline underline-offset-4"
            >
              Tout cocher
            </button>
          )}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <Choice
          legend="Questions"
          value={questionCount}
          onChange={setQuestionCount}
          options={QUESTION_COUNTS.map((n) => ({ value: n, label: String(n) }))}
        />
        <Choice
          legend="Temps par question"
          value={seconds}
          onChange={setSeconds}
          options={ANSWER_SECONDS.map((n) => ({ value: n, label: `${n} s` }))}
        />
        <Choice legend="Difficulté" value={difficulty} onChange={setDifficulty} options={DIFFICULTIES.map((d) => ({ value: d.id, label: d.label }))} />
      </div>

      <fieldset>
        <legend className={LEGEND}>Jusqu&apos;où va l&apos;histoire</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {(
            [
              { value: "anime", title: "À jour sur l'anime", detail: "Rien de ce qui n'est paru qu'en manga" },
              { value: "manga", title: "À jour sur le manga", detail: "Tout, jusqu'aux derniers chapitres" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-xl px-3.5 py-3 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-straw ${
                chosenMode === option.value ? "border-2 border-straw bg-sea-800" : "border border-sea-600 hover:border-mist"
              }`}
            >
              <input
                type="radio"
                name="mode"
                className="sr-only"
                checked={chosenMode === option.value}
                onChange={() => setMode(option.value)}
              />
              <span className="block text-[15px] font-extrabold text-foam">{option.title}</span>
              <span className="text-mist">{option.detail}</span>
            </label>
          ))}
        </div>
        {chosenMode === "manga" && (
          <p className="mt-2 text-sm text-straw">Les questions pourront spoiler ceux qui ne suivent que l&apos;anime.</p>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="font-semibold text-vest">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4 border-t border-sea-700 pt-4">
        <p className="min-w-0 flex-1 text-sm text-mist">
          Jusqu&apos;à {MAX_PLAYERS} joueurs. Pas besoin de compte pour jouer ; avec un compte, la partie rapporte des Berrys.
        </p>
        <Button type="submit" disabled={busy || games.length === 0} className="min-h-[52px] px-7 text-[17px]">
          {busy ? "Création…" : "Créer le salon"}
        </Button>
      </div>
    </form>
  );
}

function JoinRoom() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = normalizeCode(code);

  return (
    <form
      className="space-y-4 rounded-[20px] border border-sea-700 bg-sea-800 p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (clean.length === CODE_LENGTH) router.push(`/multi/${clean}`);
      }}
    >
      <h2 className="text-xl font-extrabold text-foam">Rejoindre avec un code</h2>
      <label className="block">
        <span className="sr-only">Code du salon</span>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={CODE_LENGTH + 2}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={"·".repeat(CODE_LENGTH)}
          className="h-16 w-full rounded-xl border-2 border-sea-600 bg-sea-900 text-center font-display text-4xl tracking-[0.35em] text-foam uppercase placeholder:text-mist/50 focus:border-straw focus:outline-none"
        />
      </label>
      <Button type="submit" variant={clean.length === CODE_LENGTH ? "primary" : "secondary"} disabled={clean.length !== CODE_LENGTH} className="min-h-12 w-full">
        Rejoindre le salon
      </Button>
    </form>
  );
}

function Invites() {
  const { status } = usePlayer();
  const { friends } = useFriends(status === "user");
  if (!friends?.invites.length) return null;
  return (
    <ul className="space-y-3" aria-label="Invitations">
      {friends.invites.map((invite) => (
        <li key={invite.code} className="flex flex-wrap items-center gap-4 rounded-2xl border border-straw/50 bg-straw/5 px-5 py-4">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sea-700 font-extrabold text-mist">
            {invite.from.charAt(0).toLocaleUpperCase("fr")}
          </span>
          <span className="min-w-0 flex-1 font-extrabold text-foam">{invite.from} t&apos;invite dans son salon</span>
          <Link href={`/multi/${invite.code}`} className="flex min-h-11 items-center rounded-[10px] bg-straw px-5 text-[15px] font-extrabold text-ink hover:bg-straw-dark">
            Rejoindre
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MultiHome() {
  const { status, accountsEnabled } = usePlayer();
  if (status !== "loading" && !accountsEnabled) {
    return (
      <Panel>
        <p className="text-mist">Le multijoueur n&apos;est pas disponible sur cette version du site.</p>
      </Panel>
    );
  }
  return (
    <div className="space-y-6">
      <Invites />
      <div className="grid items-start gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <JoinRoom />
        <CreateRoom />
      </div>
    </div>
  );
}
