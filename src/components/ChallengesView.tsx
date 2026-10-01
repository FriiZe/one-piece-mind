"use client";

import Link from "next/link";
import { formatNumber } from "@/games/engine/text";
import { DAILY_BERRY_CAP, isMet, objectiveProgress, OBJECTIVES, type Objective } from "@/lib/economy";
import { GAMES, isRewardless, type Game } from "@/lib/games/catalog";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { useDaily, useWeekly } from "@/lib/player/useDaily";
import { DailyStrip } from "./DailyGames";
import { CheckIcon, GameBadge } from "./GameBadge";

const PLAYABLE = GAMES.filter((game) => game.status === "live" && !isRewardless(game.slug));
const WITHIN_REACH = 4;

/** Ce que le joueur a gagné aujourd'hui, au regard du plafond journalier. */
function DailyCap() {
  const { state, status } = usePlayer();
  const { today } = useDaily();
  const earned = state.day.key === today ? state.day.earned : 0;
  return (
    <div className={`w-full space-y-1.5 sm:w-72 ${status === "loading" ? "invisible" : ""}`}>
      <p className="flex justify-between gap-3 text-[13px] font-bold">
        <span className="text-mist">Gagné aujourd&apos;hui</span>
        <span>
          {formatNumber(earned)} / {formatNumber(DAILY_BERRY_CAP)} ฿
        </span>
      </p>
      <div
        role="progressbar"
        aria-label="Gains du jour"
        aria-valuemin={0}
        aria-valuemax={DAILY_BERRY_CAP}
        aria-valuenow={earned}
        className="h-2 overflow-hidden rounded-full bg-sea-700"
      >
        <div className="h-full bg-straw" style={{ width: `${Math.min(1, earned / DAILY_BERRY_CAP) * 100}%` }} />
      </div>
    </div>
  );
}

function Weekly() {
  const { ready, challenges, daysLeft } = useWeekly();
  return (
    <section aria-labelledby="semaine" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="semaine" className="text-xl font-extrabold text-foam">
          Cette semaine
        </h2>
        <p className={`text-sm text-mist ${ready ? "" : "invisible"}`}>
          Nouveaux défis lundi, {daysLeft > 1 ? `dans ${daysLeft} jours` : "c'est le dernier jour"}
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {challenges.map((challenge, index) =>
          !ready ? (
            <li key={index} className="h-40 rounded-2xl border border-sea-700 bg-sea-800/50" aria-hidden="true" />
          ) : (
            <li
              key={challenge.label}
              className={`flex flex-col gap-3 rounded-2xl border p-4 ${
                challenge.done ? "border-emerald-400/40 bg-emerald-600/15" : "border-sea-700 bg-sea-800"
              }`}
            >
              <p className="flex items-baseline justify-between gap-3">
                <span className="font-extrabold text-foam">{challenge.label}</span>
                <span className={`shrink-0 font-display text-[22px] tracking-wide ${challenge.done ? "text-emerald-300" : "text-straw"}`}>
                  {formatNumber(challenge.berrys)} ฿
                </span>
              </p>
              <div
                role="progressbar"
                aria-label={challenge.label}
                aria-valuemin={0}
                aria-valuemax={challenge.target}
                aria-valuenow={challenge.value}
                className="mt-auto h-2.5 overflow-hidden rounded-full bg-sea-700"
              >
                <div
                  className={`h-full ${challenge.done ? "bg-emerald-300" : "bg-straw"}`}
                  style={{ width: `${(challenge.value / challenge.target) * 100}%` }}
                />
              </div>
              <p className="flex min-h-11 items-center justify-between gap-3 text-sm">
                <span className="text-mist">
                  {formatNumber(challenge.value)} sur {formatNumber(challenge.target)}
                </span>
                {challenge.done ? (
                  <span className="flex items-center gap-1.5 font-extrabold text-emerald-300">
                    <CheckIcon />
                    Récompense touchée
                  </span>
                ) : (
                  challenge.slug && (
                    <Link
                      href={`/jeux/${challenge.slug}`}
                      className="flex min-h-11 items-center rounded-[10px] border border-straw px-4 font-extrabold text-straw transition-colors hover:bg-straw/10"
                    >
                      Jouer
                    </Link>
                  )
                )}
              </p>
            </li>
          ),
        )}
      </ul>
      <p className="text-sm text-mist">Trois défis, les mêmes pour tous. La prime est versée à la fin de la partie qui termine le défi.</p>
    </section>
  );
}

type Reachable = { game: Game; objective: Objective; progress: number; caption: string };

/** Les objectifs les plus avancés du joueur, un par jeu : ce qu'il peut décrocher en une partie ou deux. */
function Objectives() {
  const { state, status } = usePlayer();

  let reached = 0;
  const candidates: Reachable[] = [];
  for (const game of PLAYABLE) {
    const stats = state.stats[game.slug];
    reached += OBJECTIVES.filter((objective) => isMet(objective, stats)).length;
    const open = OBJECTIVES.filter((objective) => !isMet(objective, stats));
    if (open.length === 0) continue;
    const objective = open.reduce((best, current) => (objectiveProgress(current, stats) > objectiveProgress(best, stats) ? current : best));
    candidates.push({
      game,
      objective,
      progress: objectiveProgress(objective, stats),
      caption: !stats?.games
        ? "Jamais essayé"
        : objective.kind === "games"
          ? `${formatNumber(stats.games)} partie${stats.games > 1 ? "s" : ""} jouée${stats.games > 1 ? "s" : ""}`
          : `Ton record : ${Math.round(stats.best * 100)} % des points`,
    });
  }
  const shown = candidates.sort((a, b) => b.progress - a.progress).slice(0, WITHIN_REACH);

  return (
    <section aria-labelledby="objectifs" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="objectifs" className="text-xl font-extrabold text-foam">
          Objectifs à portée de main
        </h2>
        <p className={`text-sm font-bold text-mist ${status === "loading" ? "invisible" : ""}`}>
          {formatNumber(reached)} objectifs atteints sur {formatNumber(PLAYABLE.length * OBJECTIVES.length)}
        </p>
      </div>
      <ul className="overflow-hidden rounded-2xl border border-sea-700">
        {shown.map(({ game, objective, progress, caption }) => (
          <li key={game.slug} className="border-b border-sea-700 last:border-b-0">
            <Link href={`/jeux/${game.slug}`} className="flex min-h-[60px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 transition-colors hover:bg-sea-800 sm:px-5">
              <GameBadge title={game.title} category={game.category} className="size-9 text-lg" />
              <span className="min-w-0 flex-1 sm:w-80 sm:flex-none">
                <span className="block text-[15px] font-extrabold text-foam">
                  {game.title} · {objective.label.charAt(0).toLowerCase() + objective.label.slice(1)}
                </span>
                <span className={`block text-[13px] text-mist ${status === "loading" ? "invisible" : ""}`}>{caption}</span>
              </span>
              <span className="order-last block h-2 w-full overflow-hidden rounded-full bg-sea-700 sm:order-none sm:w-auto sm:flex-1">
                <span className="block h-full bg-straw" style={{ width: `${progress * 100}%` }} />
              </span>
              <span className="w-20 shrink-0 text-right font-extrabold text-straw">{formatNumber(objective.berrys)} ฿</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm text-mist">Les objectifs paient une seule fois, même un jour où le jeu n&apos;est pas à l&apos;affiche.</p>
    </section>
  );
}

/** Ce qui rapporte des Berrys aujourd'hui, cette semaine, et pour de bon. */
export function ChallengesView() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">Défis</h1>
          <p className="mt-0.5 text-mist">Ce qui te rapporte des Berrys aujourd&apos;hui, cette semaine, et pour de bon.</p>
        </div>
        <DailyCap />
      </div>
      <DailyStrip segments />
      <Weekly />
      <Objectives />
    </div>
  );
}
