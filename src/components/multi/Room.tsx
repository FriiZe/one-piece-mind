"use client";

import Link from "@/components/Link";
import { CheckIcon } from "@/components/GameBadge";
import { useEffect, useMemo, useState } from "react";
import { formatNumber } from "@/games/engine/text";
import { Portrait } from "@/games/ui/Portrait";
import { Button, Panel, ShareButton } from "@/games/ui/primitives";
import { useIsClient } from "@/games/ui/storage";
import { DIFFICULTIES } from "@/games/engine/difficulty";
import { getGame } from "@/lib/games/catalog";
import { LOCALE_NAMES, localePath } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { forgetTicket, loadTicket, ROOM_ERRORS, roomAction, saveTicket, useFriends, useNow, useRoom } from "@/lib/multi/client";
import { CODE_PATTERN } from "@/lib/multi/rules";
import type { RoomPlayerView, RoomQuestionView, RoomTicket, RoomView } from "@/lib/multi/types";
import { usePlayer } from "@/lib/player/PlayerProvider";

const INPUT =
  "w-full rounded-lg border-2 border-sea-600 bg-sea-900 px-3 py-2.5 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none";

/** Rang en anglais : 1st, 2nd, 3rd, 4th… */
function englishOrdinal(rank: number): string {
  const lastTwo = rank % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : (["th", "st", "nd", "rd"][rank % 10] ?? "th");
  return `${rank}${suffix}`;
}

function Join({ code, onJoined }: { code: string; onJoined: (ticket: RoomTicket) => void }) {
  const t = useT();
  const locale = useLocale();
  const { status, username } = usePlayer();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await roomAction<{ ticket: RoomTicket }>(code, null, "join", status === "user" ? {} : { name });
    setBusy(false);
    if (result.ok) onJoined(result.ticket);
    else setError(ROOM_ERRORS[locale][result.error]);
  }

  return (
    <Panel className="mx-auto max-w-4xl">
      <form onSubmit={join} className="space-y-4">
        <h1 className="font-display text-4xl tracking-wide text-foam">
          {t("Salon", "Room")} <span className="tracking-[0.2em] text-straw">{code}</span>
        </h1>
        {status === "user" ? (
          <p className="text-mist">
            {t("Tu vas entrer en tant que", "You'll join as")} <strong className="text-foam">{username}</strong>.
          </p>
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-foam">{t("Ton pseudo", "Your name")}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              maxLength={16}
              autoComplete="nickname"
              autoFocus
              className={INPUT}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="font-semibold text-vest">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy || status === "loading"}>
            {busy ? t("Entrée…", "Entering…") : t("Entrer dans le salon", "Enter the room")}
          </Button>
          <Link href="/multi" className="text-sm text-mist underline underline-offset-4 hover:text-foam">
            {t("Retour", "Back")}
          </Link>
        </div>
      </form>
    </Panel>
  );
}

function PlayerList({
  players,
  youId,
  showScores,
  showAnswered = false,
}: {
  players: RoomPlayerView[];
  youId: string;
  showScores: boolean;
  /** Pendant une question : qui a déjà répondu. */
  showAnswered?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <ol className="space-y-2">
      {players.map((player) => (
        <li
          key={player.id}
          className={`flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 ${
            player.id === youId ? "border-2 border-straw bg-sea-900" : "border-2 border-transparent bg-sea-900"
          } ${player.connected ? "" : "opacity-50"}`}
        >
          {showScores && (
            <span className={`w-5 text-center font-display text-[22px] ${player.rank === 1 ? "text-straw" : "text-mist"}`}>{player.rank}</span>
          )}
          <span
            aria-hidden="true"
            className={`flex size-9 shrink-0 items-center justify-center rounded-full font-extrabold ${
              player.id === youId ? "bg-straw/20 text-straw" : "bg-sea-700 text-mist"
            }`}
          >
            {player.name.charAt(0).toLocaleUpperCase("fr")}
          </span>
          <span className="min-w-0 flex-1 truncate font-extrabold text-foam">
            {player.name}
            {player.id === youId && <span className="ml-1.5 font-normal text-mist">{t("(toi)", "(you)")}</span>}
            {player.isHost && <span className="ml-2 text-xs font-semibold text-mist">{t("hôte", "host")}</span>}
            {!player.connected && <span className="ml-2 text-xs font-semibold text-mist">{t("absent", "away")}</span>}
          </span>
          {showScores && <span className="font-extrabold text-foam">{formatNumber(player.score, locale)}</span>}
          {showAnswered &&
            (player.answered ? (
              <CheckIcon className="size-4 shrink-0 text-emerald-300" />
            ) : (
              <span className="shrink-0 text-xs font-bold text-mist">{t("réfléchit", "thinking")}</span>
            ))}
        </li>
      ))}
    </ol>
  );
}

function InviteFriends({ code, ticket }: { code: string; ticket: RoomTicket }) {
  const t = useT();
  const { status } = usePlayer();
  const { friends } = useFriends(status === "user");
  const [invited, setInvited] = useState<string[]>([]);
  if (!friends?.friends.length) return null;

  async function invite(friendId: string) {
    const result = await roomAction(code, ticket, "invite", { friendId });
    if (result.ok) setInvited((current) => [...current, friendId]);
  }

  return (
    <div>
      <h3 className="mb-2 font-bold text-foam">{t("Inviter un ami", "Invite a friend")}</h3>
      <ul className="flex flex-wrap gap-2">
        {friends.friends.map((friend) => (
          <li key={friend.id}>
            <Button variant="secondary" className="py-1.5 text-sm" disabled={invited.includes(friend.id)} onClick={() => invite(friend.id)}>
              {invited.includes(friend.id)
                ? t(`${friend.username} invité`, `${friend.username} invited`)
                : friend.username}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Lobby({ view, ticket, act }: { view: RoomView; ticket: RoomTicket; act: (action: string) => Promise<void> }) {
  const t = useT();
  const locale = useLocale();
  const { settings } = view;
  const difficulty = DIFFICULTIES.find((d) => d.id === settings.difficulty)?.label[locale];
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-parchment p-5 text-center text-ink sm:p-6">
        <p className="text-sm font-bold tracking-[0.25em] uppercase">{t("Code du salon", "Room code")}</p>
        <p className="font-display text-6xl tracking-[0.25em]">{view.code}</p>
        <div className="mt-3 flex justify-center">
          {/* Le lien mène à la page dans la langue du salon, celle de ses questions */}
          <ShareButton
            label={t("Copier le lien d'invitation", "Copy the invite link")}
            getText={() => `${window.location.origin}${localePath(settings.lang, `/multi/${view.code}`)}`}
          />
        </div>
      </div>

      <Panel className="space-y-4">
        <h2 className="font-display text-2xl tracking-wide text-straw">
          {t("Joueurs", "Players")}{" "}
          <span className="font-sans text-base font-semibold text-mist">· {view.players.length}</span>
        </h2>
        <PlayerList players={view.players} youId={view.you.id} showScores={false} />
        <InviteFriends code={view.code} ticket={ticket} />
        <p className="text-sm text-mist">
          {t(
            `${settings.questionCount} questions · ${settings.seconds} s par question · difficulté ${difficulty?.toLowerCase()} · joueurs à jour sur ${settings.mode === "anime" ? "l'anime" : "le manga"}`,
            `${settings.questionCount} questions · ${settings.seconds} s per question · ${difficulty?.toLowerCase()} difficulty · players caught up with ${settings.mode === "anime" ? "the anime" : "the manga"}`,
          )}
          {/* Le salon se joue dans la langue de son hôte, qui n'est pas forcément celle de l'invité */}
          {" · "}
          {t("langue des questions : ", "question language: ")}
          {LOCALE_NAMES[settings.lang]}
          <br />
          {t("Quiz : ", "Quizzes: ")}
          {settings.games.map((slug) => getGame(slug)?.title[locale] ?? slug).join(", ")}
        </p>
        {view.you.isHost ? (
          <div className="space-y-2">
            <Button onClick={() => act("start")}>{t("Lancer la partie", "Start the game")}</Button>
            {view.players.length < 2 && (
              <p className="text-sm text-mist">
                {t(
                  "Tu es seul pour l'instant : une partie en solitaire ne rapporte pas de Berrys.",
                  "You're on your own for now: a solo game doesn't earn Berries.",
                )}
              </p>
            )}
          </div>
        ) : (
          <p className="font-semibold text-foam" aria-live="polite">
            {t("En attente du lancement par l'hôte…", "Waiting for the host to start…")}
          </p>
        )}
      </Panel>
    </div>
  );
}

function Question({
  view,
  question,
  clockOffset,
  onAnswer,
}: {
  view: RoomView;
  question: RoomQuestionView;
  clockOffset: number;
  onAnswer: (optionId: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const now = useNow(true);
  const [picked, setPicked] = useState<{ index: number; optionId: string } | null>(null);
  const reveal = question.reveal;
  // La réponse cliquée s'affiche tout de suite, sans attendre la confirmation du serveur
  const chosen = question.yourAnswer ?? (picked?.index === question.index ? picked.optionId : null);
  const serverNow = now + clockOffset;
  const total = view.settings.seconds * 1000;
  const remaining = Math.max(0, Math.min(total, question.endsAt - serverNow));
  const answered = view.players.filter((p) => p.answered).length;

  return (
    <section aria-label="Question" className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="text-[15px] font-extrabold whitespace-nowrap text-foam">
          Question {question.index + 1} / {question.total}
        </span>
        <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-sea-700" aria-hidden="true">
          {!reveal && (
            <div
              className={`h-full transition-[width] duration-200 ease-linear ${remaining < 4000 ? "bg-vest" : "bg-straw"}`}
              style={{ width: `${(remaining / total) * 100}%` }}
            />
          )}
        </div>
        <span aria-live="off" className={`text-right whitespace-nowrap ${reveal ? "text-sm font-bold text-mist" : "w-14 font-display text-[34px] leading-none tracking-wide text-straw"}`}>
          {reveal
            ? t(
                `Suite dans ${Math.max(0, Math.ceil((reveal.nextAt - serverNow) / 1000))} s`,
                `Next in ${Math.max(0, Math.ceil((reveal.nextAt - serverNow) / 1000))} s`,
              )
            : `${Math.ceil(remaining / 1000)} s`}
        </span>
      </div>

      <div className="space-y-2 rounded-[20px] border border-sea-700 bg-sea-800 p-6 text-center sm:p-8">
        <p className="text-xs font-extrabold tracking-[0.15em] text-mist uppercase">{question.title}</p>
        {question.img && <Portrait img={question.img} />}
        <p className="text-2xl leading-tight font-extrabold text-foam sm:text-[30px]">{question.subject}</p>
        {question.detail && <p className="text-mist">{question.detail}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {question.options.map((option) => {
          const isAnswer = reveal?.answerId === option.id;
          const isChosen = chosen === option.id;
          const tone = reveal
            ? isAnswer
              ? "border-emerald-400 bg-emerald-600/30"
              : isChosen
                ? "border-vest bg-vest/30"
                : "border-sea-700 bg-sea-800 opacity-60"
            : isChosen
              ? "border-straw bg-straw/15"
              : chosen
                ? "border-sea-700 bg-sea-800 opacity-60"
                : "cursor-pointer border-sea-600 bg-sea-800 hover:border-straw";
          return (
            <button
              key={option.id}
              type="button"
              disabled={!!chosen || !!reveal || remaining === 0}
              onClick={() => {
                setPicked({ index: question.index, optionId: option.id });
                onAnswer(option.id);
              }}
              className={`flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${tone}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                {option.img && <Portrait img={option.img} className="h-20 w-16 shrink-0" />}
                <span className="min-w-0">
                  <span className="block text-lg font-extrabold text-foam">
                    {reveal && isAnswer ? "✓ " : reveal && isChosen ? "✗ " : ""}
                    {option.label}
                  </span>
                  {option.detail && <span className="block text-sm text-mist">{option.detail}</span>}
                  {!reveal && isChosen && (
                    <span className="block text-[13px] font-extrabold text-straw">{t("Ta réponse", "Your answer")}</span>
                  )}
                </span>
              </span>
              {reveal && <span className="shrink-0 text-sm font-semibold text-mist">{reveal.counts[option.id] ?? 0}</span>}
            </button>
          );
        })}
      </div>

      <p className={`min-h-6 text-center ${reveal ? "font-bold text-foam" : "text-[15px] text-mist"}`} aria-live="polite">
        {reveal
          ? `${
              reveal.yourPoints > 0
                ? t(
                    `Bonne réponse : +${formatNumber(reveal.yourPoints, locale)} points.`,
                    `Correct: +${formatNumber(reveal.yourPoints, locale)} ${reveal.yourPoints === 1 ? "point" : "points"}.`,
                  )
                : chosen
                  ? t("Raté.", "Wrong.")
                  : t("Pas de réponse.", "No answer.")
            } ${reveal.explanation}`
          : chosen
            ? t(
                `Réponse enregistrée. La correction s'affiche quand tout le monde a répondu, ou à la fin du temps (${answered} sur ${view.players.length}).`,
                `Answer saved. The right answer shows once everyone has answered, or when time runs out (${answered} of ${view.players.length}).`,
              )
            : t(
                "Plus tu réponds vite, plus la bonne réponse rapporte.",
                "The faster you answer, the more a correct answer is worth.",
              )}
      </p>
    </section>
  );
}

function Final({ view, act }: { view: RoomView; act: (action: string) => Promise<void> }) {
  // Les Berrys de la partie viennent d'être versés : le solde affiché dans l'en-tête doit suivre
  const t = useT();
  const locale = useLocale();
  const { refresh } = usePlayer();
  const rewarded = view.reward?.berrys ?? null;
  useEffect(() => {
    if (rewarded !== null) refresh();
  }, [rewarded, refresh]);

  const you = view.players.find((p) => p.id === view.you.id);
  const winner = view.players[0];
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-parchment p-5 text-ink sm:p-6" role="status">
        <p className="text-sm font-bold tracking-[0.25em] uppercase">{t("Partie terminée", "Game over")}</p>
        <h2 className="font-display text-4xl tracking-wide">
          {winner.id === view.you.id
            ? t("Tu l'emportes !", "You win!")
            : t(`${winner.name} l'emporte`, `${winner.name} wins`)}
        </h2>
        {you && (
          <p className="mt-1 font-semibold">
            {t(
              `Tu finis ${you.rank === 1 ? "1er" : `${you.rank}e`} sur ${view.players.length}, avec ${formatNumber(you.score, locale)} points.`,
              `You finish ${englishOrdinal(you.rank)} out of ${view.players.length}, with ${formatNumber(you.score, locale)} ${you.score === 1 ? "point" : "points"}.`,
            )}
          </p>
        )}
        {view.reward ? (
          <p className="mt-2 font-display text-3xl tracking-wide text-vest-dark">
            +{formatNumber(view.reward.berrys, locale)} ฿
          </p>
        ) : (
          <p className="mt-2 text-sm">
            {t(
              "Avec un compte, cette partie t'aurait rapporté des Berrys.",
              "With an account, this game would have earned you Berries.",
            )}{" "}
            <Link href="/profil" className="underline underline-offset-4">
              {t("Créer un compte", "Create an account")}
            </Link>
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {view.you.isHost ? (
            <Button onClick={() => act("restart")}>
              {t("Rejouer avec les mêmes joueurs", "Play again with the same players")}
            </Button>
          ) : (
            <span className="font-semibold">
              {t("L'hôte peut relancer une partie.", "The host can start a new game.")}
            </span>
          )}
          <Link href="/multi" className="underline underline-offset-4">
            {t("Quitter le salon", "Leave the room")}
          </Link>
        </div>
      </div>
      <Panel className="space-y-3">
        <h2 className="font-display text-2xl tracking-wide text-straw">{t("Classement", "Leaderboard")}</h2>
        <PlayerList players={view.players} youId={view.you.id} showScores />
      </Panel>
    </div>
  );
}

export function Room({ code }: { code: string }) {
  const t = useT();
  const locale = useLocale();
  const isClient = useIsClient();
  const [joined, setJoined] = useState<RoomTicket | null>(null);
  const [left, setLeft] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Le ticket gardé par le navigateur permet de retrouver sa place après un rechargement.
  // Il est lu une seule fois : un nouvel objet à chaque affichage relancerait la relecture du salon.
  const stored = useMemo(() => (isClient ? loadTicket(code) : null), [isClient, code]);
  const ticket = left ? null : (joined ?? stored);
  const { view, clockOffset, error, stale, refresh } = useRoom(ticket);

  if (!CODE_PATTERN.test(code)) {
    return (
      <Panel className="mx-auto max-w-4xl space-y-3">
        <p className="text-foam">{t("Ce code de salon n'est pas valide.", "This room code isn't valid.")}</p>
        <Link href="/multi" className="font-bold text-straw underline underline-offset-4">
          {t("Retour au multijoueur", "Back to multiplayer")}
        </Link>
      </Panel>
    );
  }
  if (!isClient) return <Panel className="mx-auto max-w-4xl">{t("Chargement du salon…", "Loading the room…")}</Panel>;

  if (!ticket) {
    return (
      <Join
        code={code}
        onJoined={(next) => {
          saveTicket(next);
          setLeft(false);
          setJoined(next);
        }}
      />
    );
  }

  if (error === "not-found") {
    return (
      <Panel className="mx-auto max-w-4xl space-y-3">
        <p className="text-foam">
          {t(
            "Ce salon n'existe plus, ou ta place n'y est plus réservée.",
            "This room no longer exists, or your seat in it is no longer held.",
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              forgetTicket(code);
              setJoined(null);
              setLeft(true);
            }}
          >
            {t("Essayer d'y entrer", "Try to join it")}
          </Button>
          <Link href="/multi" className="self-center text-mist underline underline-offset-4 hover:text-foam">
            {t("Retour au multijoueur", "Back to multiplayer")}
          </Link>
        </div>
      </Panel>
    );
  }
  if (!view) return <Panel className="mx-auto max-w-4xl">{t("Connexion au salon…", "Connecting to the room…")}</Panel>;

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setActionError(null);
    const result = await roomAction(code, ticket, action, payload);
    if (!result.ok) setActionError(ROOM_ERRORS[locale][result.error]);
    refresh();
  }

  return (
    <div className={`space-y-4 ${view.status === "playing" ? "" : "mx-auto max-w-4xl"}`}>
      {view.status === "lobby" && <Lobby view={view} ticket={ticket} act={act} />}
      {view.status === "playing" && view.question && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Question
            view={view}
            question={view.question}
            clockOffset={clockOffset}
            onAnswer={(optionId) => act("answer", { questionIndex: view.question!.index, optionId })}
          />
          <aside className="space-y-3.5 rounded-[20px] border border-sea-700 bg-sea-800 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-extrabold text-foam">{t("Classement", "Leaderboard")}</h2>
              {!view.question.reveal && (
                <span className="text-[13px] text-mist">
                  {t(
                    `${view.players.filter((p) => p.answered).length} réponse${view.players.filter((p) => p.answered).length > 1 ? "s" : ""} sur ${view.players.length}`,
                    `${view.players.filter((p) => p.answered).length} of ${view.players.length} answered`,
                  )}
                </span>
              )}
            </div>
            <PlayerList players={view.players} youId={view.you.id} showScores showAnswered={!view.question.reveal} />
          </aside>
        </div>
      )}
      {view.status === "finished" && <Final view={view} act={act} />}
      <p className="min-h-6 text-sm font-semibold text-vest" aria-live="polite">
        {actionError ??
          (stale ? t("Connexion au salon perdue : nouvelle tentative…", "Lost connection to the room: retrying…") : "")}
      </p>
    </div>
  );
}
