"use client";

import Link from "next/link";
import { formatNumber } from "@/games/engine/text";
import { usePlayer } from "@/lib/player/PlayerProvider";

/** Navigation de l'en-tête, avec le solde de Berrys du joueur. */
export function HeaderNav() {
  const { status, state, username } = usePlayer();
  return (
    <nav aria-label="Navigation principale" className="flex items-center gap-3 text-sm font-semibold text-mist sm:gap-5">
      <Link href="/jeux" className="hover:text-foam">
        Jeux
      </Link>
      <Link href="/defis" className="hover:text-foam">
        Défis
      </Link>
      <Link href="/collection" className="hover:text-foam">
        Collection
      </Link>
      <Link
        href="/profil"
        className="rounded-full border border-straw/40 bg-straw/10 px-3 py-1 text-straw hover:bg-straw/20"
        aria-label={`Profil, ${formatNumber(state.berrys)} Berrys`}
      >
        {/* Le solde n'est connu qu'une fois le navigateur prêt : on réserve sa place pour éviter un saut */}
        <span className={status === "loading" ? "invisible" : ""}>฿ {formatNumber(state.berrys)}</span>
        {username && <span className="ml-2 hidden text-foam sm:inline">{username}</span>}
      </Link>
    </nav>
  );
}
