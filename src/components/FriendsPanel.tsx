"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { formatNumber } from "@/games/engine/text";
import { Button } from "@/games/ui/primitives";
import { rankOf } from "@/lib/economy";
import type { Localized } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { notificationsChanged, useFriends } from "@/lib/multi/client";
import type { FriendError, FriendResult } from "@/lib/multi/friends";
import {
  answerFriendRequestAction,
  cancelFriendRequestAction,
  removeFriendAction,
  requestFriendAction,
} from "@/lib/player/friend-actions";
import { usePlayer } from "@/lib/player/PlayerProvider";

const ERRORS: Localized<Record<FriendError, string>> = {
  fr: {
    "unknown-user": "Aucun joueur ne porte ce pseudo.",
    self: "C'est ton propre pseudo.",
    already: "Vous êtes déjà amis, ou une demande est déjà en attente.",
    limit: "Trop de demandes pour l'instant. Réessaie plus tard.",
    "not-found": "Cette demande n'existe plus.",
    unavailable: "Action indisponible pour l'instant.",
  },
  en: {
    "unknown-user": "No player has that username.",
    self: "That's your own username.",
    already: "You're already friends, or a request is already pending.",
    limit: "Too many requests for now. Try again later.",
    "not-found": "This request no longer exists.",
    unavailable: "This action is unavailable right now.",
  },
};

/** Amis du joueur connecté : en ajouter par pseudo, répondre aux demandes, voir les invitations. */
export function FriendsPanel() {
  const { status } = usePlayer();
  const { friends, reload } = useFriends(status === "user");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();
  const locale = useLocale();

  if (status !== "user") return null;

  async function run(action: () => Promise<FriendResult>, success: (result: FriendResult & { ok: true }) => string) {
    setBusy(true);
    const result = await action().catch((): FriendResult => ({ ok: false, error: "unavailable" }));
    setBusy(false);
    setMessage(result.ok ? { text: success(result), ok: true } : { text: ERRORS[locale][result.error], ok: false });
    reload();
    notificationsChanged();
  }

  return (
    <section aria-labelledby="amis" className="space-y-4 rounded-2xl border border-sea-700 bg-sea-800 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="amis" className="text-xl font-extrabold text-foam">
          {t("Amis", "Friends")}{" "}
          <span className="text-base font-semibold text-mist">· {friends?.friends.length ?? 0}</span>
        </h2>
        {!!friends?.friends.length && (
          <Link href="/echanges" className="text-sm font-bold text-straw underline underline-offset-4">
            {t("Échanger des avis", "Trade posters")}
          </Link>
        )}
      </div>

      {friends?.incoming.map((request) => (
        <div key={request.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-straw/50 bg-straw/5 px-4 py-3">
          <p className="min-w-0 flex-1 text-mist">
            <strong className="text-foam">{request.username}</strong>{" "}
            {t("te demande en ami.", "sent you a friend request.")}
          </p>
          <span className="flex gap-2">
            <Button
              className="min-h-11 text-sm"
              disabled={busy}
              onClick={() =>
                run(
                  () => answerFriendRequestAction(request.id, true),
                  () => t(`${request.username} et toi êtes maintenant amis.`, `You and ${request.username} are now friends.`),
                )
              }
            >
              {t("Accepter", "Accept")}
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 text-sm"
              disabled={busy}
              onClick={() =>
                run(
                  () => answerFriendRequestAction(request.id, false),
                  () => t("Demande refusée.", "Request declined."),
                )
              }
            >
              {t("Refuser", "Decline")}
            </Button>
          </span>
        </div>
      ))}

      {friends?.invites.map((invite) => (
        <div key={invite.code} className="flex flex-wrap items-center gap-3 rounded-xl border border-straw/50 bg-straw/5 px-4 py-3">
          <p className="min-w-0 flex-1 text-mist">
            <strong className="text-foam">{invite.from}</strong>{" "}
            {t("t'invite dans son salon.", "is inviting you to their room.")}
          </p>
          <Link href={`/multi/${invite.code}`} className="flex min-h-11 items-center rounded-lg bg-straw px-4 text-sm font-bold text-ink hover:bg-straw-dark">
            {t("Rejoindre", "Join")}
          </Link>
        </div>
      ))}

      {!friends ? (
        <p className="text-mist">{t("Chargement…", "Loading…")}</p>
      ) : friends.friends.length === 0 ? (
        <p className="text-mist">
          {t(
            "Aucun ami pour l'instant. Ajoute quelqu'un par son pseudo pour l'inviter dans tes salons et échanger des avis.",
            "No friends yet. Add someone by their username to invite them to your rooms and trade posters.",
          )}
        </p>
      ) : (
        <ul className="space-y-2">
          {friends.friends.map((friend) => (
            <li key={friend.id} className="flex items-center gap-3 rounded-xl border border-sea-700 px-3 py-2">
              <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sea-700 font-extrabold text-mist">
                {friend.username.charAt(0).toLocaleUpperCase("fr")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-foam">{friend.username}</span>
                <span className="block text-[13px] text-mist">
                  {rankOf(friend.bounty).title[locale]} · ฿ {formatNumber(friend.bounty, locale)}
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                className="min-h-11 cursor-pointer px-1 text-sm text-mist underline underline-offset-4 hover:text-foam"
                onClick={() =>
                  run(
                    () => removeFriendAction(friend.id),
                    () => t(`${friend.username} n'est plus dans tes amis.`, `${friend.username} is no longer one of your friends.`),
                  )
                }
              >
                {t("Retirer", "Remove")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {friends?.outgoing.length ? (
        <ul className="space-y-1">
          {friends.outgoing.map((request) => (
            <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-mist">
              <span>
                {t(`Demande envoyée à ${request.username} · en attente`, `Request sent to ${request.username} · pending`)}
              </span>
              <button
                type="button"
                disabled={busy}
                className="min-h-11 cursor-pointer underline underline-offset-4 hover:text-foam"
                onClick={() =>
                  run(
                    () => cancelFriendRequestAction(request.id),
                    () => t("Demande annulée.", "Request canceled."),
                  )
                }
              >
                {t("Annuler", "Cancel")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="flex flex-wrap items-end gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          const name = username.trim();
          if (!name) return;
          run(
            () => requestFriendAction(name),
            (result) =>
              result.accepted
                ? t(`${name} et toi êtes maintenant amis.`, `You and ${name} are now friends.`)
                : t(`Demande envoyée à ${name}.`, `Request sent to ${name}.`),
          ).then(() => setUsername(""));
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block text-sm font-bold text-foam">
            {t("Ajouter un ami par son pseudo", "Add a friend by username")}
          </span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={t("Pseudo", "Username")}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="h-11 w-full rounded-[10px] border border-sea-600 bg-sea-900 px-3 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none"
          />
        </label>
        <Button type="submit" variant="secondary" className="min-h-11 text-sm" disabled={busy || !username.trim()}>
          {t("Envoyer la demande", "Send request")}
        </Button>
      </form>
      <p className={`min-h-5 text-sm font-semibold ${message?.ok ? "text-emerald-300" : "text-vest"}`} aria-live="polite">
        {message?.text}
      </p>
    </section>
  );
}
