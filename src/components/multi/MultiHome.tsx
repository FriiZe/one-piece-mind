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
  "w-full rounded-lg border-2 border-sea-600 bg-sea-900 px-3 py-2.5 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none";

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
      <legend className="mb-1.5 text-sm font-semibold text-foam">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`cursor-pointer rounded-full border-2 px-3 py-1.5 text-sm font-bold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-straw ${
              value === option.value ? "border-straw bg-straw text-ink" : "border-sea-600 text-mist hover:border-mist"
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
    <Panel>
      <form onSubmit={create} className="space-y-4">
        <h2 className="font-display text-3xl tracking-wide text-straw">Créer un salon</h2>
        {status !== "user" && (
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-foam">Ton pseudo</span>
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
        <Choice
          legend="Les joueurs sont à jour sur"
          value={chosenMode}
          onChange={setMode}
          options={[
            { value: "anime", label: "l'anime" },
            { value: "manga", label: "le manga" },
          ]}
        />
        {chosenMode === "manga" && (
          <p className="text-sm text-straw">Les questions pourront spoiler ceux qui ne suivent que l&apos;anime.</p>
        )}
        <Choice
          legend="Difficulté"
          value={difficulty}
          onChange={setDifficulty}
          options={DIFFICULTIES.map((d) => ({ value: d.id, label: d.label }))}
        />
        <Choice
          legend="Nombre de questions"
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
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-foam">Quiz dans lesquels piocher</legend>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {MIX_SLUGS.map((slug) => (
              <label key={slug} className="flex cursor-pointer items-center gap-2 text-mist">
                <input
                  type="checkbox"
                  checked={games.includes(slug)}
                  onChange={() => toggle(slug)}
                  className="h-4 w-4 accent-straw"
                />
                {getGame(slug)?.title ?? slug}
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="font-semibold text-vest">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || games.length === 0}>
          {busy ? "Création…" : "Créer le salon"}
        </Button>
      </form>
    </Panel>
  );
}

function JoinRoom() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = normalizeCode(code);

  return (
    <Panel>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (clean.length === CODE_LENGTH) router.push(`/multi/${clean}`);
        }}
      >
        <h2 className="font-display text-3xl tracking-wide text-straw">Rejoindre un salon</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-foam">Code du salon</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            maxLength={CODE_LENGTH + 2}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABCDE"
            className={`${INPUT} text-center font-display text-3xl tracking-[0.3em] uppercase placeholder:tracking-[0.3em]`}
          />
        </label>
        <Button type="submit" disabled={clean.length !== CODE_LENGTH}>
          Rejoindre
        </Button>
      </form>
    </Panel>
  );
}

function Invites() {
  const { status } = usePlayer();
  const { friends } = useFriends(status === "user");
  if (!friends?.invites.length) return null;
  return (
    <div className="rounded-2xl bg-parchment p-5 text-ink">
      <h2 className="font-display text-2xl tracking-wide">Invitations</h2>
      <ul className="mt-2 space-y-2">
        {friends.invites.map((invite) => (
          <li key={invite.code} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>{invite.from}</strong> t&apos;invite dans son salon.
            </span>
            <Link href={`/multi/${invite.code}`} className="rounded-lg bg-vest px-4 py-2 font-bold text-white hover:bg-vest-dark">
              Rejoindre
            </Link>
          </li>
        ))}
      </ul>
    </div>
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
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.4fr]">
        <JoinRoom />
        <CreateRoom />
      </div>
      <p className="text-sm text-mist">
        Jusqu&apos;à {MAX_PLAYERS} joueurs par salon. Pas besoin de compte pour jouer ; avec un compte, la partie rapporte
        des Berrys.
      </p>
    </div>
  );
}
