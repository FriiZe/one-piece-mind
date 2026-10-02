"use client";

import { DIFFICULTIES } from "@/games/engine/difficulty";
import { formatNumber } from "@/games/engine/text";
import { isMet, objectiveLevel, objectiveProgress, OBJECTIVES, SKILL_FACTOR } from "@/lib/economy";
import { hasDifficulty, type LiveSlug } from "@/lib/games/catalog";
import { useLocale, useT } from "@/lib/i18n/client";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { CheckIcon } from "./GameBadge";

/** Objectifs du jeu affiché, avec l'avancement du joueur. */
export function GameObjectives({ slug }: { slug: LiveSlug }) {
  const { state, status } = usePlayer();
  const t = useT();
  const locale = useLocale();
  const stats = state.stats[slug];
  const reached = OBJECTIVES.filter((objective) => isMet(objective, stats)).length;
  // Dans un jeu à niveaux, la prime d'un objectif de score dépend de la difficulté où il est réussi
  const levels = hasDifficulty(slug);
  const top = Math.max(...Object.values(SKILL_FACTOR));

  return (
    <section aria-labelledby="objectifs" className="space-y-3 rounded-2xl border border-sea-700 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="objectifs" className="text-lg font-extrabold text-foam">
          {t("Objectifs", "Goals")}
        </h2>
        <span className={`text-sm font-bold text-mist ${status === "loading" ? "invisible" : ""}`}>
          {t(`${reached} sur ${OBJECTIVES.length}`, `${reached} of ${OBJECTIVES.length}`)}
        </span>
      </div>
      <ul className="space-y-2.5 text-sm">
        {OBJECTIVES.map((objective) => {
          const met = isMet(objective, stats);
          const progress = objectiveProgress(objective, stats);
          const level = objectiveLevel(objective, stats);
          const tiered = levels && objective.kind === "best";
          // Tout est gagné quand l'objectif est atteint, et au plus haut niveau s'il en a
          const complete = met && (!tiered || level >= top);
          return (
            <li key={objective.id} className="space-y-1.5">
              <p className="flex items-center justify-between gap-3">
                <span className={`flex items-center gap-2 ${met ? "text-emerald-300" : "text-foam"}`}>
                  {met && <CheckIcon className="size-3.5 shrink-0" />}
                  {objective.label[locale]}
                  {met && <span className="sr-only">{t(" (atteint)", " (reached)")}</span>}
                </span>
                <span className={`shrink-0 font-extrabold ${complete ? "text-emerald-300" : "text-straw"}`}>
                  {tiered
                    ? t(
                        `jusqu'à +${formatNumber(objective.berrys * top, locale)} ฿`,
                        `up to +${formatNumber(objective.berrys * top, locale)} ฿`,
                      )
                    : `+${formatNumber(objective.berrys, locale)} ฿`}
                </span>
              </p>
              {tiered && (
                <p className="flex flex-wrap gap-1.5 text-xs font-bold">
                  {DIFFICULTIES.map((difficulty) => {
                    const factor = SKILL_FACTOR[difficulty.id];
                    const earned = level >= factor;
                    return (
                      <span
                        key={difficulty.id}
                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                          earned ? "border-emerald-400/40 text-emerald-300" : "border-sea-600 text-mist"
                        }`}
                      >
                        {earned && <CheckIcon className="size-3 shrink-0" />}
                        {difficulty.label[locale]} : {formatNumber(Math.round(objective.berrys * factor), locale)} ฿
                        {earned && <span className="sr-only">{t(" (acquis)", " (earned)")}</span>}
                      </span>
                    );
                  })}
                </p>
              )}
              {!met && progress > 0 && (
                <div
                  role="progressbar"
                  aria-label={objective.label[locale]}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                  className="h-1.5 overflow-hidden rounded-full bg-sea-800"
                >
                  <div className="h-full bg-straw" style={{ width: `${progress * 100}%` }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {levels && (
        <p className="text-xs text-mist">
          {t(
            "La prime d'un objectif de score dépend de la difficulté de la partie. Le réussir ensuite à un niveau plus haut verse la différence.",
            "The reward for a score goal depends on the difficulty of the game. Beating it later at a higher level pays the difference.",
          )}
        </p>
      )}
    </section>
  );
}

/** Rappel du parcours du joueur sur ce jeu : son meilleur résultat et ses parties. */
export function GameRecord({ slug }: { slug: LiveSlug }) {
  const { state, status } = usePlayer();
  const t = useT();
  const locale = useLocale();
  const stats = state.stats[slug];
  if (status === "loading" || !stats || stats.games === 0) return null;
  return (
    <span className="inline-flex min-h-9 items-center text-sm font-bold text-mist">
      {t(
        `Ton record : ${Math.round(stats.best * 100)} % des points · ${formatNumber(stats.games, locale)} partie${stats.games > 1 ? "s" : ""}`,
        `Your best: ${Math.round(stats.best * 100)}% of the points · ${formatNumber(stats.games, locale)} ${stats.games === 1 ? "game" : "games"}`,
      )}
    </span>
  );
}
