"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatNumber } from "@/games/engine/text";
import { Portrait } from "@/games/ui/Portrait";
import { Button, Panel, ShareButton } from "@/games/ui/primitives";
import { useIsClient } from "@/games/ui/storage";
import { DIFFICULTIES } from "@/games/engine/difficulty";
import { getGame } from "@/lib/games/catalog";
import { forgetTicket, loadTicket, ROOM_ERRORS, roomAction, saveTicket, useFriends, useNow, useRoom } from "@/lib/multi/client";
import { CODE_PATTERN } from "@/lib/multi/rules";
import type { RoomPlayerView, RoomQuestionView, RoomTicket, RoomView } from "@/lib/multi/types";
import { usePlayer } from "@/lib/player/PlayerProvider";

const INPUT =
  "w-full rounded-lg border-2 border-sea-600 bg-sea-900 px-3 py-2.5 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none";

function Join({ code, onJoined }: { code: string; onJoined: (ticket: RoomTicket) => void }) {
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
    else setError(ROOM_ERRORS[result.error]);
  }

  return (
    <Panel>
      <form onSubmit={join} className="space-y-4">
        <h1 className="font-display text-4xl tracking-wide text-foam">
          Salon <span className="tracking-[0.2em] text-straw">{code}</span>
        </h1>
        {status === "user" ? (
          <p className="text-mist">
            Tu vas entrer en tant que <strong className="text-foam">{username}</strong>.
          </p>
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-foam">Ton pseudo</span>
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
            {busy ? "Entrée…" : "Entrer dans le salon"}
          </Button>
          <Link href="/multi" className="text-sm text-mist underline underline-offset-4 hover:text-foam">
            Retour
          </Link>
        </div>
      </form>
    </Panel>
  );
}

function PlayerList({ players, youId, showScores }: { players: RoomPlayerView[]; youId: string; showScores: boolean }) {
  return (
    <ol className="space-y-1.5">
      {players.map((player) => (
        <li
          key={player.id}
          className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
            player.id === youId ? "border-straw bg-straw/10" : "border-sea-700 bg-sea-800/70"
          } ${player.connected ? "" : "opacity-50"}`}
        >
          {showScores && <span className="w-6 text-center font-display text-xl text-straw">{player.rank}</span>}
          <span className="min-w-0 flex-1 truncate font-bold text-foam">
            {player.name}
            {player.isHost && <span className="ml-2 text-xs font-semibold text-mist">hôte</span>}
            {player.id === youId && <span className="ml-2 text-xs font-semibold text-straw">toi</span>}
            {!player.connected && <span className="ml-2 text-xs font-semibold text-mist">absent</span>}
          </span>
          {showScores && <span className="font-display text-xl tracking-wide text-foam">{formatNumber(player.score)}</span>}
        </li>
      ))}
    </ol>
  );
}

function InviteFriends({ code, ticket }: { code: string; ticket: RoomTicket }) {
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
      <h3 className="mb-2 font-bold text-foam">Inviter un ami</h3>
      <ul className="flex flex-wrap gap-2">
        {friends.friends.map((friend) => (
          <li key={friend.id}>
            <Button variant="secondary" className="py-1.5 text-sm" disabled={invited.includes(friend.id)} onClick={() => invite(friend.id)}>
              {invited.includes(friend.id) ? `${friend.username} invité` : friend.username}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Lobby({ view, ticket, act }: { view: RoomView; ticket: RoomTicket; act: (action: string) => Promise<void> }) {
  const { settings } = view;
  const difficulty = DIFFICULTIES.find((d) => d.id === settings.difficulty)?.label;
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-parchment p-5 text-center text-ink sm:p-6">
        <p className="text-sm font-bold tracking-[0.25em] uppercase">Code du salon</p>
        <p className="font-display text-6xl tracking-[0.25em]">{view.code}</p>
        <div className="mt-3 flex justify-center">
          <ShareButton label="Copier le lien d'invitation" getText={() => `${window.location.origin}/multi/${view.code}`} />
        </div>
      </div>

      <Panel className="space-y-4">
        <h2 className="font-display text-2xl tracking-wide text-straw">
          Joueurs <span className="font-sans text-base font-semibold text-mist">· {view.players.length}</span>
        </h2>
        <PlayerList players={view.players} youId={view.you.id} showScores={false} />
        <InviteFriends code={view.code} ticket={ticket} />
        <p className="text-sm text-mist">
          {settings.questionCount} questions · {settings.seconds} s par question · difficulté {difficulty?.toLowerCase()} ·
          joueurs à jour sur {settings.mode === "anime" ? "l'anime" : "le manga"}
          <br />
          Quiz : {settings.games.map((slug) => getGame(slug)?.title ?? slug).join(", ")}
        </p>
        {view.you.isHost ? (
          <div className="space-y-2">
            <Button onClick={() => act("start")}>Lancer la partie</Button>
            {view.players.length < 2 && (
              <p className="text-sm text-mist">Tu es seul pour l&apos;instant : une partie en solitaire ne rapporte pas de Berrys.</p>
            )}
          </div>
        ) : (
          <p className="font-semibold text-foam" aria-live="polite">
            En attente du lancement par l&apos;hôte…
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
    <Panel className="space-y-4">
      <div className="flex items-center justify-between text-sm font-semibold text-mist">
        <span>
          Question {question.index + 1} / {question.total}
        </span>
        <span aria-live="off">
          {reveal
            ? `Suite dans ${Math.max(0, Math.ceil((reveal.nextAt - serverNow) / 1000))} s`
            : `${Math.ceil(remaining / 1000)} s`}
        </span>
      </div>
      {!reveal && (
        <div className="h-2 overflow-hidden rounded-full bg-sea-700" aria-hidden="true">
          <div
            className={`h-full transition-[width] duration-200 ease-linear ${remaining < 4000 ? "bg-vest" : "bg-straw"}`}
            style={{ width: `${(remaining / total) * 100}%` }}
          />
        </div>
      )}

      <div className="space-y-2 text-center">
        <p className="text-mist">{question.title}</p>
        {question.img && <Portrait img={question.img} />}
        <p className="font-display text-3xl tracking-wide text-straw">{question.subject}</p>
        {question.detail && <p className="text-mist">{question.detail}</p>}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
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
              ? "border-straw bg-straw/20"
              : chosen
                ? "border-sea-700 bg-sea-800 opacity-60"
                : "border-sea-600 bg-sea-700 hover:border-straw";
          return (
            <button
              key={option.id}
              type="button"
              disabled={!!chosen || !!reveal || remaining === 0}
              onClick={() => {
                setPicked({ index: question.index, optionId: option.id });
                onAnswer(option.id);
              }}
              className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${tone}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                {option.img && <Portrait img={option.img} className="h-20 w-16 shrink-0" />}
                <span className="min-w-0">
                  <span className="block font-bold text-foam">
                    {reveal && isAnswer ? "✓ " : reveal && isChosen ? "✗ " : ""}
                    {option.label}
                  </span>
                  {option.detail && <span className="block text-sm text-mist">{option.detail}</span>}
                </span>
              </span>
              {reveal && <span className="shrink-0 text-sm font-semibold text-mist">{reveal.counts[option.id] ?? 0}</span>}
            </button>
          );
        })}
      </div>

      <p className="min-h-6 font-semibold text-foam" aria-live="polite">
        {reveal
          ? `${reveal.yourPoints > 0 ? `Bonne réponse : +${formatNumber(reveal.yourPoints)} points.` : chosen ? "Raté." : "Pas de réponse."} ${reveal.explanation}`
          : chosen
            ? `Réponse enregistrée. ${answered} joueur${answered > 1 ? "s ont" : " a"} répondu sur ${view.players.length}.`
            : ""}
      </p>
    </Panel>
  );
}

function Final({ view, act }: { view: RoomView; act: (action: string) => Promise<void> }) {
  // Les Berrys de la partie viennent d'être versés : le solde affiché dans l'en-tête doit suivre
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
        <p className="text-sm font-bold tracking-[0.25em] uppercase">Partie terminée</p>
        <h2 className="font-display text-4xl tracking-wide">
          {winner.id === view.you.id ? "Tu l'emportes !" : `${winner.name} l'emporte`}
        </h2>
        {you && (
          <p className="mt-1 font-semibold">
            Tu finis {you.rank === 1 ? "1er" : `${you.rank}e`} sur {view.players.length}, avec {formatNumber(you.score)} points.
          </p>
        )}
        {view.reward ? (
          <p className="mt-2 font-display text-3xl tracking-wide text-vest-dark">+{formatNumber(view.reward.berrys)} ฿</p>
        ) : (
          <p className="mt-2 text-sm">
            Avec un compte, cette partie t&apos;aurait rapporté des Berrys.{" "}
            <Link href="/profil" className="underline underline-offset-4">
              Créer un compte
            </Link>
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {view.you.isHost ? (
            <Button onClick={() => act("restart")}>Rejouer avec les mêmes joueurs</Button>
          ) : (
            <span className="font-semibold">L&apos;hôte peut relancer une partie.</span>
          )}
          <Link href="/multi" className="underline underline-offset-4">
            Quitter le salon
          </Link>
        </div>
      </div>
      <Panel className="space-y-3">
        <h2 className="font-display text-2xl tracking-wide text-straw">Classement</h2>
        <PlayerList players={view.players} youId={view.you.id} showScores />
      </Panel>
    </div>
  );
}

export function Room({ code }: { code: string }) {
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
      <Panel className="space-y-3">
        <p className="text-foam">Ce code de salon n&apos;est pas valide.</p>
        <Link href="/multi" className="font-bold text-straw underline underline-offset-4">
          Retour au multijoueur
        </Link>
      </Panel>
    );
  }
  if (!isClient) return <Panel>Chargement du salon…</Panel>;

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
      <Panel className="space-y-3">
        <p className="text-foam">Ce salon n&apos;existe plus, ou ta place n&apos;y est plus réservée.</p>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              forgetTicket(code);
              setJoined(null);
              setLeft(true);
            }}
          >
            Essayer d&apos;y entrer
          </Button>
          <Link href="/multi" className="self-center text-mist underline underline-offset-4 hover:text-foam">
            Retour au multijoueur
          </Link>
        </div>
      </Panel>
    );
  }
  if (!view) return <Panel>Connexion au salon…</Panel>;

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setActionError(null);
    const result = await roomAction(code, ticket, action, payload);
    if (!result.ok) setActionError(ROOM_ERRORS[result.error]);
    refresh();
  }

  return (
    <div className="space-y-4">
      {view.status === "lobby" && <Lobby view={view} ticket={ticket} act={act} />}
      {view.status === "playing" && view.question && (
        <>
          <Question
            view={view}
            question={view.question}
            clockOffset={clockOffset}
            onAnswer={(optionId) => act("answer", { questionIndex: view.question!.index, optionId })}
          />
          {view.question.reveal && (
            <Panel className="space-y-3">
              <h2 className="font-display text-2xl tracking-wide text-straw">Classement</h2>
              <PlayerList players={view.players.slice(0, 5)} youId={view.you.id} showScores />
            </Panel>
          )}
        </>
      )}
      {view.status === "finished" && <Final view={view} act={act} />}
      <p className="min-h-6 text-sm font-semibold text-vest" aria-live="polite">
        {actionError ?? (stale ? "Connexion au salon perdue : nouvelle tentative…" : "")}
      </p>
    </div>
  );
}
