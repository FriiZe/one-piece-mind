"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { useT } from "@/lib/i18n/client";
import { notificationsChanged, useFriends, useNotifications } from "@/lib/multi/client";
import { answerFriendRequestAction } from "@/lib/player/friend-actions";
import { usePlayer } from "@/lib/player/PlayerProvider";

/**
 * Cloche de l'en-tête, pour le joueur connecté : demandes d'ami reçues,
 * invitations dans un salon et, pour un administrateur, quiz à relire.
 */
export function NotificationBell() {
  const { status } = usePlayer();
  const t = useT();
  const enabled = status === "user";
  const counts = useNotifications(enabled);
  const [open, setOpen] = useState(false);
  // Le détail n'est chargé qu'à l'ouverture : la cloche fermée ne demande que des nombres
  const { friends, reload } = useFriends(enabled && open);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (!enabled) return null;

  const total = counts ? counts.requests + counts.invites + counts.trades + counts.hiddenQuizzes : 0;
  const empty =
    friends && friends.incoming.length === 0 && friends.invites.length === 0 && !counts?.trades && !counts?.hiddenQuizzes;

  async function answer(requestId: string, accept: boolean) {
    setBusy(true);
    setError(null);
    const result = await answerFriendRequestAction(requestId, accept).catch(() => ({ ok: false }) as const);
    setBusy(false);
    if (!result.ok) setError(t("Cette demande n'a pas pu être traitée.", "This request couldn't be processed."));
    reload();
    notificationsChanged();
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={total > 0 ? t(`Notifications : ${total} en attente`, `Notifications: ${total} pending`) : "Notifications"}
        className={`relative flex size-9 items-center justify-center rounded-full border transition-colors ${
          total > 0 ? "border-vest/60 bg-vest/15 text-foam hover:bg-vest/25" : "border-sea-600 text-mist hover:text-foam"
        }`}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-5">
          <path d="M10 2a5 5 0 0 0-5 5v2.6l-1.3 2.6A1 1 0 0 0 4.6 14h10.8a1 1 0 0 0 .9-1.8L15 9.6V7a5 5 0 0 0-5-5Zm-2 13a2 2 0 0 0 4 0H8Z" />
        </svg>
        {total > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-vest px-1 text-xs font-bold text-white">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-4 top-16 z-20 space-y-3 rounded-2xl border border-sea-600 bg-sea-800 p-4 text-sm shadow-2xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80"
        >
          <p className="font-display text-2xl tracking-wide text-straw">Notifications</p>

          {!friends ? (
            <p className="text-mist">{t("Chargement…", "Loading…")}</p>
          ) : empty ? (
            <p className="text-mist">{t("Rien de neuf pour l'instant.", "Nothing new for now.")}</p>
          ) : (
            <ul className="space-y-3">
              {friends.invites.map((invite) => (
                <li key={`salon-${invite.code}`} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 text-mist">
                    <strong className="text-foam">{invite.from}</strong>{" "}
                    {t("t'invite dans son salon.", "invites you to their room.")}
                  </span>
                  <Link
                    href={`/multi/${invite.code}`}
                    onClick={() => setOpen(false)}
                    className="shrink-0 rounded-lg bg-vest px-3 py-1.5 font-bold text-white hover:bg-vest-dark"
                  >
                    {t("Rejoindre", "Join")}
                  </Link>
                </li>
              ))}
              {friends.incoming.map((request) => (
                <li key={request.id} className="space-y-1.5">
                  <p className="text-mist">
                    <strong className="text-foam">{request.username}</strong>{" "}
                    {t("te demande en ami.", "sent you a friend request.")}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => answer(request.id, true)}
                      className="rounded-lg bg-straw px-3 py-1.5 font-bold text-ink hover:bg-straw-dark disabled:opacity-50"
                    >
                      {t("Accepter", "Accept")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => answer(request.id, false)}
                      className="rounded-lg border border-sea-600 bg-sea-700 px-3 py-1.5 font-bold text-foam hover:bg-sea-600 disabled:opacity-50"
                    >
                      {t("Refuser", "Decline")}
                    </button>
                  </div>
                </li>
              ))}
              {counts && counts.trades > 0 && (
                <li className="flex items-center justify-between gap-2">
                  <span className="text-mist">
                    <strong className="text-foam">
                      {t(
                        `${counts.trades} échange${counts.trades > 1 ? "s" : ""}`,
                        `${counts.trades} ${counts.trades === 1 ? "trade" : "trades"}`,
                      )}
                    </strong>{" "}
                    {t(`proposé${counts.trades > 1 ? "s" : ""} par tes amis.`, "offered by your friends.")}
                  </span>
                  <Link
                    href="/echanges"
                    onClick={() => setOpen(false)}
                    className="shrink-0 font-bold text-straw underline underline-offset-4"
                  >
                    {t("Voir", "View")}
                  </Link>
                </li>
              )}
              {counts && counts.hiddenQuizzes > 0 && (
                <li className="flex items-center justify-between gap-2">
                  <span className="text-mist">
                    <strong className="text-foam">
                      {t(
                        `${counts.hiddenQuizzes} quiz masqué${counts.hiddenQuizzes > 1 ? "s" : ""}`,
                        `${counts.hiddenQuizzes} hidden ${counts.hiddenQuizzes === 1 ? "quiz" : "quizzes"}`,
                      )}
                    </strong>{" "}
                    {t("à relire.", "to review.")}
                  </span>
                  <Link
                    href="/quiz"
                    onClick={() => setOpen(false)}
                    className="shrink-0 font-bold text-straw underline underline-offset-4"
                  >
                    {t("Voir", "View")}
                  </Link>
                </li>
              )}
            </ul>
          )}

          {error && (
            <p role="alert" className="font-semibold text-vest">
              {error}
            </p>
          )}
          <p className="border-t border-sea-700 pt-3">
            <Link href="/profil#amis" onClick={() => setOpen(false)} className="font-semibold text-mist underline underline-offset-4 hover:text-foam">
              {t("Gérer mes amis", "Manage my friends")}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
