"use client";

import Link from "next/link";
import { formatNumber } from "@/games/engine/text";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { NotificationBell } from "./NotificationBell";

const LINKS = [
  { href: "/jeux", label: "Jeux" },
  { href: "/multi", label: "Multi" },
  { href: "/quiz", label: "Quiz" },
  { href: "/defis", label: "Défis" },
  { href: "/collection", label: "Collection" },
  { href: "/boutique", label: "Boutique" },
];

/** Rubriques du site. Sur téléphone, elles passent sur une seconde ligne, sous le logo et le compte. */
export function HeaderNav() {
  return (
    <nav
      aria-label="Navigation principale"
      className="order-3 flex w-full items-center gap-3 text-sm font-semibold text-mist sm:order-none sm:ml-auto sm:w-auto sm:gap-4"
    >
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="hover:text-foam">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-4 shrink-0">
      <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H3Z" />
    </svg>
  );
}

/** Compte du joueur dans l'en-tête : notifications, solde de Berrys et accès au profil ou à la connexion. */
export function HeaderAccount() {
  const { status, accountsEnabled, state, username } = usePlayer();
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <NotificationBell />
      <Link
        href="/profil"
        className="flex items-center gap-2 rounded-full border border-straw/40 bg-straw/10 px-3 py-1.5 text-straw hover:bg-straw/20"
        aria-label={`${username ? `Mon compte, ${username}` : "Mon profil"}, ${formatNumber(state.berrys)} Berrys`}
      >
        {username && (
          <span className="flex min-w-0 items-center gap-1.5 text-foam">
            <UserIcon />
            {/* Sur téléphone, l'icône seule : le pseudo ferait passer le compte à la ligne */}
            <span className="hidden max-w-40 truncate sm:inline">{username}</span>
          </span>
        )}
        {/* Le solde n'est connu qu'une fois le navigateur prêt : on réserve sa place pour éviter un saut */}
        <span className={`whitespace-nowrap ${status === "loading" ? "invisible" : ""}`}>฿ {formatNumber(state.berrys)}</span>
      </Link>
      {status === "guest" && accountsEnabled && (
        <Link
          href="/profil#compte"
          className="flex items-center gap-1.5 rounded-full bg-straw px-3 py-1.5 font-bold whitespace-nowrap text-ink hover:bg-straw-dark"
        >
          <UserIcon />
          Connexion
        </Link>
      )}
    </div>
  );
}
