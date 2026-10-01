"use client";

import Link from "next/link";
import { useState } from "react";
import { formatNumber } from "@/games/engine/text";
import { Button, Panel } from "@/games/ui/primitives";
import { rankOf } from "@/lib/economy";
import { notificationsChanged, useFriends } from "@/lib/multi/client";
import type { FriendError, FriendResult } from "@/lib/multi/friends";
import {
  answerFriendRequestAction,
  cancelFriendRequestAction,
  removeFriendAction,
  requestFriendAction,
} from "@/lib/player/friend-actions";
import { usePlayer } from "@/lib/player/PlayerProvider";

const ERRORS: Record<FriendError, string> = {
  "unknown-user": "Aucun joueur ne porte ce pseudo.",
  self: "C'est ton propre pseudo.",
  already: "Vous êtes déjà amis, ou une demande est déjà en attente.",
  limit: "Trop de demandes pour l'instant. Réessaie plus tard.",
  "not-found": "Cette demande n'existe plus.",
  unavailable: "Action indisponible pour l'instant.",
};

/** Amis du joueur connecté : en ajouter par pseudo, répondre aux demandes, voir les invitations. */
export function FriendsPanel() {
  const { status } = usePlayer();
  const { friends, reload } = useFriends(status === "user");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  if (status !== "user") return null;

  async function run(action: () => Promise<FriendResult>, success: (result: FriendResult & { ok: true }) => string) {
    setBusy(true);
    const result = await action().catch((): FriendResult => ({ ok: false, error: "unavailable" }));
    setBusy(false);
    setMessage(result.ok ? { text: success(result), ok: true } : { text: ERRORS[result.error], ok: false });
    reload();
    notificationsChanged();
  }

  return (
    <section aria-labelledby="amis" className="space-y-3">
      <h2 id="amis" className="font-display text-3xl tracking-wide text-straw">
        Mes amis
      </h2>
      <Panel className="space-y-5">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const name = username.trim();
            if (!name) return;
            run(
              () => requestFriendAction(name),
              (result) => (result.accepted ? `${name} et toi êtes maintenant amis.` : `Demande envoyée à ${name}.`),
            ).then(() => setUsername(""));
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-sm font-semibold text-foam">Ajouter un ami par son pseudo</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              maxLength={20}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full rounded-lg border-2 border-sea-600 bg-sea-900 px-3 py-2.5 text-foam focus:border-straw focus:outline-none"
            />
          </label>
          <Button type="submit" disabled={busy || !username.trim()}>
            Envoyer la demande
          </Button>
        </form>
        <p className={`min-h-6 text-sm font-semibold ${message?.ok ? "text-emerald-300" : "text-vest"}`} aria-live="polite">
          {message?.text}
        </p>

        {friends?.invites.length ? (
          <div>
            <h3 className="mb-2 font-bold text-foam">Invitations dans un salon</h3>
            <ul className="space-y-2">
              {friends.invites.map((invite) => (
                <li key={invite.code} className="flex flex-wrap items-center justify-between gap-2 text-mist">
                  <span>
                    <strong className="text-foam">{invite.from}</strong> t&apos;invite dans son salon.
                  </span>
                  <Link href={`/multi/${invite.code}`} className="font-bold text-straw underline underline-offset-4">
                    Rejoindre
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {friends?.incoming.length ? (
          <div>
            <h3 className="mb-2 font-bold text-foam">Demandes reçues</h3>
            <ul className="space-y-2">
              {friends.incoming.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-foam">{request.username}</span>
                  <span className="flex gap-2">
                    <Button
                      className="py-1.5 text-sm"
                      disabled={busy}
                      onClick={() => run(() => answerFriendRequestAction(request.id, true), () => `${request.username} et toi êtes maintenant amis.`)}
                    >
                      Accepter
                    </Button>
                    <Button
                      variant="secondary"
                      className="py-1.5 text-sm"
                      disabled={busy}
                      onClick={() => run(() => answerFriendRequestAction(request.id, false), () => "Demande refusée.")}
                    >
                      Refuser
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <h3 className="mb-2 font-bold text-foam">
            Amis <span className="font-semibold text-mist">· {friends?.friends.length ?? 0}</span>
          </h3>
          {!friends ? (
            <p className="text-mist">Chargement…</p>
          ) : friends.friends.length === 0 ? (
            <p className="text-mist">Aucun ami pour l&apos;instant. Ajoute quelqu&apos;un par son pseudo pour l&apos;inviter dans tes salons.</p>
          ) : (
            <ul className="space-y-2">
              {friends.friends.map((friend) => (
                <li key={friend.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sea-700 px-3 py-2">
                  <span>
                    <span className="font-bold text-foam">{friend.username}</span>
                    <span className="ml-2 text-sm text-mist">
                      {rankOf(friend.bounty).title} · ฿ {formatNumber(friend.bounty)}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    className="text-sm text-mist underline underline-offset-4 hover:text-foam"
                    onClick={() => run(() => removeFriendAction(friend.id), () => `${friend.username} n'est plus dans tes amis.`)}
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {friends?.outgoing.length ? (
          <div>
            <h3 className="mb-2 font-bold text-foam">Demandes envoyées</h3>
            <ul className="space-y-2">
              {friends.outgoing.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 text-mist">
                  <span>{request.username} · en attente</span>
                  <button
                    type="button"
                    disabled={busy}
                    className="text-sm underline underline-offset-4 hover:text-foam"
                    onClick={() => run(() => cancelFriendRequestAction(request.id), () => "Demande annulée.")}
                  >
                    Annuler
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>
    </section>
  );
}
