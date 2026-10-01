"use client";

import Link from "next/link";
import { formatNumber } from "@/games/engine/text";
import { useDailyKey, useIsClient } from "@/games/ui/storage";
import { currentWeek, DAILY_CHALLENGE_BERRYS, daysLeftInWeek, weekKey, weeklyChallenges } from "@/lib/economy";
import { usePlayer } from "@/lib/player/PlayerProvider";

/** Le défi du jour et les trois défis de la semaine, avec l'avancement du joueur. */
export function ChallengesView() {
  const { state, status } = usePlayer();
  // La page est construite à l'avance : la semaine en cours n'est connue que dans le navigateur
  const isClient = useIsClient();
  const today = useDailyKey();
  const week = weekKey(today);
  const challenges = weeklyChallenges(week);
  const progress = currentWeek(state.week, week);
  const daysLeft = daysLeftInWeek(today);

  return (
    <div className="space-y-8">
      <section aria-labelledby="jour" className="rounded-2xl bg-parchment p-5 text-ink sm:p-6">
        <h2 id="jour" className="font-display text-3xl tracking-wide">
          Le défi du jour
        </h2>
        <p className="mt-1 max-w-2xl">
          Un personnage mystère, le même pour tout le monde. Trouve-le pour gagner jusqu&apos;à{" "}
          {formatNumber(DAILY_CHALLENGE_BERRYS)} ฿ et recruter un personnage à coup sûr.
        </p>
        <Link
          href="/jeux/onepiecedle"
          className="mt-4 inline-block rounded-lg bg-vest px-5 py-3 font-bold text-white transition-colors hover:bg-vest-dark"
        >
          Jouer au défi du jour
        </Link>
      </section>

      <section aria-labelledby="semaine" className="space-y-4">
        <div>
          <h2 id="semaine" className="font-display text-3xl tracking-wide text-straw">
            Les défis de la semaine
          </h2>
          <p className="mt-1 text-mist">
            Trois défis, les mêmes pour tous les joueurs. Ils changent chaque lundi
            {isClient && (daysLeft > 1 ? ` : il reste ${daysLeft} jours` : " : c'est le dernier jour")}.
          </p>
        </div>
        {!isClient && <p className="text-mist">Chargement des défis…</p>}
        <ul className="space-y-3" hidden={!isClient}>
          {challenges.map((challenge, index) => {
            const done = progress.done[index];
            const value = Math.min(challenge.target, progress.progress[index] ?? 0);
            return (
              <li
                key={challenge.label}
                className={`rounded-xl border p-4 ${done ? "border-emerald-400/60 bg-emerald-600/10" : "border-sea-700 bg-sea-800/70"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-bold text-foam">
                    {done && <span aria-hidden="true">✓ </span>}
                    {challenge.label}
                    {done && <span className="sr-only"> (réussi)</span>}
                  </p>
                  <p className="font-display text-xl tracking-wide text-straw">+{formatNumber(challenge.berrys)} ฿</p>
                </div>
                <div
                  role="progressbar"
                  aria-label={challenge.label}
                  aria-valuemin={0}
                  aria-valuemax={challenge.target}
                  aria-valuenow={value}
                  className="mt-3 h-2 overflow-hidden rounded-full bg-sea-700"
                >
                  <div
                    className={`h-full ${done ? "bg-emerald-400" : "bg-straw"}`}
                    style={{ width: `${(value / challenge.target) * 100}%` }}
                  />
                </div>
                <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-mist">
                  <span className={status === "loading" ? "invisible" : ""}>
                    {formatNumber(value)} sur {formatNumber(challenge.target)}
                  </span>
                  {challenge.slug && !done && (
                    <Link href={`/jeux/${challenge.slug}`} className="font-semibold text-foam underline underline-offset-4">
                      Y jouer
                    </Link>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-mist">
          La prime d&apos;un défi est versée dès qu&apos;il est réussi, à la fin de la partie qui le termine.
        </p>
      </section>
    </div>
  );
}
