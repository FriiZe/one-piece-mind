"use client";

import Link from "@/components/Link";
import { formatNumber } from "@/games/engine/text";
import { DAILY_BERRY_CAP, isMet, objectiveProgress, OBJECTIVES, type Objective } from "@/lib/economy";
import { GAMES, isRewardless, type Game } from "@/lib/games/catalog";
import { useLocale, useT } from "@/lib/i18n/client";
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
  const t = useT();
  const locale = useLocale();
  const earned = state.day.key === today ? state.day.earned : 0;
  return (
    <div className={`w-full space-y-1.5 sm:w-72 ${status === "loading" ? "invisible" : ""}`}>
      <p className="flex justify-between gap-3 text-[13px] font-bold">
        <span className="text-mist">{t("Gagné aujourd'hui", "Earned today")}</span>
        <span>
          {formatNumber(earned, locale)} / {formatNumber(DAILY_BERRY_CAP, locale)} ฿
        </span>
      </p>
      <div
        role="progressbar"
        aria-label={t("Gains du jour", "Today's earnings")}
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
  const t = useT();
  const locale = useLocale();
  return (
    <section aria-labelledby="semaine" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="semaine" className="text-xl font-extrabold text-foam">
          {t("Cette semaine", "This week")}
        </h2>
        <p className={`text-sm text-mist ${ready ? "" : "invisible"}`}>
          {t(
            `Nouveaux défis lundi, ${daysLeft > 1 ? `dans ${daysLeft} jours` : "c'est le dernier jour"}`,
            `New challenges on Monday, ${daysLeft > 1 ? `in ${daysLeft} days` : "this is the last day"}`,
          )}
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {challenges.map((challenge, index) =>
          !ready ? (
            <li key={index} className="h-40 rounded-2xl border border-sea-700 bg-sea-800/50" aria-hidden="true" />
          ) : (
            <li
              key={challenge.label.fr}
              className={`flex flex-col gap-3 rounded-2xl border p-4 ${
                challenge.done ? "border-emerald-400/40 bg-emerald-600/15" : "border-sea-700 bg-sea-800"
              }`}
            >
              <p className="flex items-baseline justify-between gap-3">
                <span className="font-extrabold text-foam">{challenge.label[locale]}</span>
                <span className={`shrink-0 font-display text-[22px] tracking-wide ${challenge.done ? "text-emerald-300" : "text-straw"}`}>
                  {formatNumber(challenge.berrys, locale)} ฿
                </span>
              </p>
              <div
                role="progressbar"
                aria-label={challenge.label[locale]}
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
                  {formatNumber(challenge.value, locale)} {t("sur", "of")} {formatNumber(challenge.target, locale)}
                </span>
                {challenge.done ? (
                  <span className="flex items-center gap-1.5 font-extrabold text-emerald-300">
                    <CheckIcon />
                    {t("Récompense touchée", "Reward earned")}
                  </span>
                ) : (
                  challenge.slug && (
                    <Link
                      href={`/jeux/${challenge.slug}`}
                      className="flex min-h-11 items-center rounded-[10px] border border-straw px-4 font-extrabold text-straw transition-colors hover:bg-straw/10"
                    >
                      {t("Jouer", "Play")}
                    </Link>
                  )
                )}
              </p>
            </li>
          ),
        )}
      </ul>
      <p className="text-sm text-mist">
        {t(
          "Trois défis, les mêmes pour tous. La prime est versée à la fin de la partie qui termine le défi.",
          "Three challenges, the same for everyone. The reward is paid out at the end of the game that completes the challenge.",
        )}
      </p>
    </section>
  );
}

type Reachable = { game: Game; objective: Objective; progress: number; caption: string };

/** Les objectifs les plus avancés du joueur, un par jeu : ce qu'il peut décrocher en une partie ou deux. */
function Objectives() {
  const { state, status } = usePlayer();
  const t = useT();
  const locale = useLocale();

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
        ? t("Jamais essayé", "Never tried")
        : objective.kind === "games"
          ? t(
              `${formatNumber(stats.games, locale)} partie${stats.games > 1 ? "s" : ""} jouée${stats.games > 1 ? "s" : ""}`,
              `${formatNumber(stats.games, locale)} ${stats.games === 1 ? "game" : "games"} played`,
            )
          : t(
              `Ton record : ${Math.round(stats.best * 100)} % des points`,
              `Your best: ${Math.round(stats.best * 100)}% of the points`,
            ),
    });
  }
  const shown = candidates.sort((a, b) => b.progress - a.progress).slice(0, WITHIN_REACH);

  return (
    <section aria-labelledby="objectifs" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="objectifs" className="text-xl font-extrabold text-foam">
          {t("Objectifs à portée de main", "Goals within reach")}
        </h2>
        <p className={`text-sm font-bold text-mist ${status === "loading" ? "invisible" : ""}`}>
          {t(
            `${formatNumber(reached, locale)} objectifs atteints sur ${formatNumber(PLAYABLE.length * OBJECTIVES.length, locale)}`,
            `${formatNumber(reached, locale)} of ${formatNumber(PLAYABLE.length * OBJECTIVES.length, locale)} goals reached`,
          )}
        </p>
      </div>
      <ul className="overflow-hidden rounded-2xl border border-sea-700">
        {shown.map(({ game, objective, progress, caption }) => (
          <li key={game.slug} className="border-b border-sea-700 last:border-b-0">
            <Link href={`/jeux/${game.slug}`} className="flex min-h-[60px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 transition-colors hover:bg-sea-800 sm:px-5">
              <GameBadge title={game.title[locale]} category={game.category} className="size-9 text-lg" />
              <span className="min-w-0 flex-1 sm:w-80 sm:flex-none">
                <span className="block text-[15px] font-extrabold text-foam">
                  {game.title[locale]} ·{" "}
                  {objective.label[locale].charAt(0).toLowerCase() + objective.label[locale].slice(1)}
                </span>
                <span className={`block text-[13px] text-mist ${status === "loading" ? "invisible" : ""}`}>{caption}</span>
              </span>
              <span className="order-last block h-2 w-full overflow-hidden rounded-full bg-sea-700 sm:order-none sm:w-auto sm:flex-1">
                <span className="block h-full bg-straw" style={{ width: `${progress * 100}%` }} />
              </span>
              <span className="w-20 shrink-0 text-right font-extrabold text-straw">
                {formatNumber(objective.berrys, locale)} ฿
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm text-mist">
        {t(
          "Les objectifs paient une seule fois, même un jour où le jeu n'est pas à l'affiche.",
          "Goals pay out only once, even on a day when the game isn't in the daily selection.",
        )}
      </p>
    </section>
  );
}

/** Ce qui rapporte des Berrys aujourd'hui, cette semaine, et pour de bon. */
export function ChallengesView() {
  const t = useT();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">{t("Défis", "Challenges")}</h1>
          <p className="mt-0.5 text-mist">
            {t(
              "Ce qui te rapporte des Berrys aujourd'hui, cette semaine, et pour de bon.",
              "What earns you Berries today, this week, and for good.",
            )}
          </p>
        </div>
        <DailyCap />
      </div>
      <DailyStrip segments />
      <Weekly />
      <Objectives />
    </div>
  );
}
