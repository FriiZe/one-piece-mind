"use client";

import Link from "next/link";
import { formatNumber } from "@/games/engine/text";
import { playerBounty, RANKS, rankOf } from "@/lib/economy";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { useWeekly } from "@/lib/player/useDaily";

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

function BountyCard() {
  const { state, status } = usePlayer();
  const bounty = playerBounty(state);
  const rank = rankOf(bounty);
  const from = RANKS.find((r) => r.title === rank.title)?.from ?? 0;
  const progress = rank.next ? Math.min(1, (bounty - from) / (rank.next.from - from)) : 1;

  return (
    <Link href="/profil" className="flex flex-col gap-2.5 rounded-2xl bg-parchment p-4 text-ink transition-opacity hover:opacity-90">
      <span className="text-xs font-extrabold tracking-[0.15em] uppercase">Ta prime</span>
      <span className={`font-display text-[26px] leading-none tracking-wide ${status === "loading" ? "invisible" : ""}`}>
        ฿ {formatNumber(bounty)}
      </span>
      <span className="mt-auto block h-2 overflow-hidden rounded-full bg-parchment-dark">
        <span className="block h-full bg-ink" style={{ width: `${progress * 100}%` }} />
      </span>
      <span className={`flex justify-between gap-2 text-[13px] font-bold ${status === "loading" ? "invisible" : ""}`}>
        <span>{rank.title}</span>
        <span>{rank.next ? `${rank.next.title} à ${compact.format(rank.next.from)}` : "Rang le plus élevé"}</span>
      </span>
    </Link>
  );
}

/** Sous les jeux du jour : les trois défis de la semaine et la prime du joueur. */
export function HomeStrip() {
  const { ready, challenges } = useWeekly();

  return (
    <section aria-label="Défis de la semaine et prime" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {challenges.map((challenge, index) => {
        if (!ready) return <div key={index} className="h-[132px] rounded-2xl border border-sea-700 bg-sea-800/50" aria-hidden="true" />;
        const href = challenge.slug && !challenge.done ? `/jeux/${challenge.slug}` : "/defis";
        return (
          <Link
            key={challenge.label}
            href={href}
            className={`flex flex-col gap-2.5 rounded-2xl border p-4 transition-colors ${
              challenge.done ? "border-emerald-400/40 bg-emerald-600/15" : "border-sea-700 bg-sea-800 hover:border-straw"
            }`}
          >
            <span className={`text-xs font-extrabold tracking-[0.15em] uppercase ${challenge.done ? "text-emerald-300" : "text-mist"}`}>
              {challenge.done ? "Défi réussi" : "Défi de la semaine"}
            </span>
            <span className="text-[15px] font-bold text-foam">{challenge.label}</span>
            <span className="mt-auto block h-2 overflow-hidden rounded-full bg-sea-900">
              <span
                className={`block h-full ${challenge.done ? "bg-emerald-300" : "bg-straw"}`}
                style={{ width: `${(challenge.value / challenge.target) * 100}%` }}
              />
            </span>
            <span className="flex justify-between gap-2 text-[13px] font-bold">
              <span className="text-mist">
                {formatNumber(challenge.value)} / {formatNumber(challenge.target)}
              </span>
              <span className={challenge.done ? "text-emerald-300" : "text-straw"}>+{formatNumber(challenge.berrys)} ฿</span>
            </span>
          </Link>
        );
      })}
      <BountyCard />
    </section>
  );
}
