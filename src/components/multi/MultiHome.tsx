"use client";

import Link from "@/components/Link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DIFFICULTIES, type Difficulty } from "@/games/engine/difficulty";
import { MIX_SLUGS } from "@/games/qcm/logic";
import { Button, Panel } from "@/games/ui/primitives";
import { useStored } from "@/games/ui/storage";
import { getGame, type LiveSlug } from "@/lib/games/catalog";
import { useLocale, useLocalePath, useT } from "@/lib/i18n/client";
import { createRoomRequest, ROOM_ERRORS, saveTicket, useFriends } from "@/lib/multi/client";
import {
  ANSWER_SECONDS,
  CODE_LENGTH,
  DEFAULT_SETTINGS,
  isQcmSlug,
  MAX_PLAYERS,
  normalizeCode,
  QUESTION_COUNTS,
  ROOM_GAME_SLUGS,
  ROOM_SLUGS,
} from "@/lib/multi/rules";
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
  const t = useT();
  const locale = useLocale();
  const path = useLocalePath();
  const router = useRouter();
  const { status } = usePlayer();
  const [storedMode] = useStored<SpoilerMode | null>("opm.mode", null);
  const [mode, setMode] = useState<SpoilerMode | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [games, setGames] = useState<LiveSlug[]>([...ROOM_SLUGS]);
  const [questionCount, setQuestionCount] = useState<number>(DEFAULT_SETTINGS.questionCount);
  const [seconds, setSeconds] = useState<number>(DEFAULT_SETTINGS.seconds);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Le mode du salon reprend par défaut celui du joueur ; à défaut, le mode anime, qui ne révèle rien
  const chosenMode = mode ?? storedMode ?? "anime";

  function toggle(slug: LiveSlug) {
    setGames((current) => (current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug]));
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createRoomRequest(
      { mode: chosenMode, difficulty, games, questionCount, seconds, lang: locale },
      status === "user" ? undefined : name,
    );
    if (!result.ok) {
      setBusy(false);
      setError(ROOM_ERRORS[locale][result.error]);
      return;
    }
    saveTicket(result.ticket);
    router.push(path(`/multi/${result.ticket.code}`));
  }

  return (
    <form onSubmit={create} className="space-y-5 rounded-[20px] border-2 border-straw bg-straw/5 p-5 sm:p-6">
      <h2 className="text-xl font-extrabold text-foam">{t("Créer un salon", "Create a room")}</h2>
      {status !== "user" && (
        <label className="block max-w-sm">
          <span className={`block ${LEGEND}`}>{t("Ton pseudo", "Your name")}</span>
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

      <fieldset className="space-y-3">
        <legend className={LEGEND}>
          {t(
            `Jeux tirés au sort · ${games.length} choisi${games.length > 1 ? "s" : ""}`,
            `Games drawn at random · ${games.length} selected`,
          )}
        </legend>
        {(
          [
            {
              slugs: MIX_SLUGS,
              title: t("QCM, chronométrés", "Quiz questions, timed"),
              detail: t("Plus tu réponds vite, plus tu marques.", "The faster you answer, the more you score."),
            },
            {
              slugs: ROOM_GAME_SLUGS,
              title: t("Autres jeux, sans chrono", "Other games, no timer"),
              detail: t(
                "Une grille, un mot, un classement… : moins d'essais ou d'erreurs, plus de points.",
                "One grid, one word, one ranking…: fewer tries or mistakes, more points.",
              ),
            },
          ] as const
        ).map((group) => (
          <div key={group.title}>
            <p className="mb-2 text-sm text-mist">
              <span className="font-bold text-foam">{group.title}</span> · {group.detail}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.slugs.map((slug) => {
                const checked = games.includes(slug);
                return (
                  <label
                    key={slug}
                    className={`flex min-h-11 cursor-pointer items-center rounded-full px-3.5 text-sm font-bold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-straw ${
                      checked ? "bg-straw text-ink" : "border border-sea-600 text-mist hover:text-foam"
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(slug)} className="sr-only" />
                    {getGame(slug)?.title[locale] ?? slug}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-4">
          {games.length < ROOM_SLUGS.length && (
            <button
              type="button"
              onClick={() => setGames([...ROOM_SLUGS])}
              className="min-h-11 cursor-pointer text-sm font-bold text-straw underline underline-offset-4"
            >
              {t("Tout cocher", "Select all")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setGames([...MIX_SLUGS])}
            className="min-h-11 cursor-pointer text-sm font-bold text-straw underline underline-offset-4"
          >
            {t("QCM seulement", "Quiz questions only")}
          </button>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <Choice
          legend={t("Manches", "Rounds")}
          value={questionCount}
          onChange={setQuestionCount}
          options={QUESTION_COUNTS.map((n) => ({ value: n, label: String(n) }))}
        />
        {/* Le chrono ne concerne que les QCM : sans eux, rien à régler */}
        {games.some(isQcmSlug) && (
          <Choice
            legend={t("Temps par QCM", "Time per quiz question")}
            value={seconds}
            onChange={setSeconds}
            options={ANSWER_SECONDS.map((n) => ({ value: n, label: `${n} s` }))}
          />
        )}
        <Choice
          legend={t("Difficulté", "Difficulty")}
          value={difficulty}
          onChange={setDifficulty}
          options={DIFFICULTIES.map((d) => ({ value: d.id, label: d.label[locale] }))}
        />
      </div>

      <fieldset>
        <legend className={LEGEND}>{t("Jusqu'où va l'histoire", "How far the story goes")}</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {(
            [
              {
                value: "anime",
                title: t("À jour sur l'anime", "Caught up with the anime"),
                detail: t("Rien de ce qui n'est paru qu'en manga", "Nothing that's only out in the manga"),
              },
              {
                value: "manga",
                title: t("À jour sur le manga", "Caught up with the manga"),
                detail: t("Tout, jusqu'aux derniers chapitres", "Everything, up to the latest chapters"),
              },
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
          <p className="mt-2 text-sm text-straw">
            {t(
              "Les questions pourront spoiler ceux qui ne suivent que l'anime.",
              "The questions may spoil those who only follow the anime.",
            )}
          </p>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="font-semibold text-vest">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4 border-t border-sea-700 pt-4">
        <p className="min-w-0 flex-1 text-sm text-mist">
          {t(
            `Jusqu'à ${MAX_PLAYERS} joueurs. Pas besoin de compte pour jouer ; avec un compte, la partie rapporte des Berrys.`,
            `Up to ${MAX_PLAYERS} players. No account needed to play; with an account, the game earns you Berries.`,
          )}
        </p>
        <Button type="submit" disabled={busy || games.length === 0} className="min-h-[52px] px-7 text-[17px]">
          {busy ? t("Création…", "Creating…") : t("Créer le salon", "Create the room")}
        </Button>
      </div>
    </form>
  );
}

function JoinRoom() {
  const t = useT();
  const path = useLocalePath();
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = normalizeCode(code);

  return (
    <form
      className="space-y-4 rounded-[20px] border border-sea-700 bg-sea-800 p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (clean.length === CODE_LENGTH) router.push(path(`/multi/${clean}`));
      }}
    >
      <h2 className="text-xl font-extrabold text-foam">{t("Rejoindre avec un code", "Join with a code")}</h2>
      <label className="block">
        <span className="sr-only">{t("Code du salon", "Room code")}</span>
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
        {t("Rejoindre le salon", "Join the room")}
      </Button>
    </form>
  );
}

function Invites() {
  const t = useT();
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
          <span className="min-w-0 flex-1 font-extrabold text-foam">
            {t(`${invite.from} t'invite dans son salon`, `${invite.from} invites you to their room`)}
          </span>
          <Link href={`/multi/${invite.code}`} className="flex min-h-11 items-center rounded-[10px] bg-straw px-5 text-[15px] font-extrabold text-ink hover:bg-straw-dark">
            {t("Rejoindre", "Join")}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MultiHome() {
  const t = useT();
  const { status, accountsEnabled } = usePlayer();
  if (status !== "loading" && !accountsEnabled) {
    return (
      <Panel>
        <p className="text-mist">
          {t(
            "Le multijoueur n'est pas disponible sur cette version du site.",
            "Multiplayer isn't available on this version of the site.",
          )}
        </p>
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
