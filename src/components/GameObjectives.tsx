"use client";

import { formatNumber } from "@/games/engine/text";
import { isMet, objectiveProgress, OBJECTIVES } from "@/lib/economy";
import type { LiveSlug } from "@/lib/games/catalog";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { CheckIcon } from "./GameBadge";

/** Objectifs du jeu affiché, avec l'avancement du joueur. */
export function GameObjectives({ slug }: { slug: LiveSlug }) {
  const { state, status } = usePlayer();
  const stats = state.stats[slug];
  const reached = OBJECTIVES.filter((objective) => isMet(objective, stats)).length;

  return (
    <section aria-labelledby="objectifs" className="space-y-3 rounded-2xl border border-sea-700 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="objectifs" className="text-lg font-extrabold text-foam">
          Objectifs
        </h2>
        <span className={`text-sm font-bold text-mist ${status === "loading" ? "invisible" : ""}`}>
          {reached} sur {OBJECTIVES.length}
        </span>
      </div>
      <ul className="space-y-2.5 text-sm">
        {OBJECTIVES.map((objective) => {
          const met = isMet(objective, stats);
          const progress = objectiveProgress(objective, stats);
          return (
            <li key={objective.id} className="space-y-1.5">
              <p className="flex items-center justify-between gap-3">
                <span className={`flex items-center gap-2 ${met ? "text-emerald-300" : "text-foam"}`}>
                  {met && <CheckIcon className="size-3.5 shrink-0" />}
                  {objective.label}
                  {met && <span className="sr-only"> (atteint)</span>}
                </span>
                <span className={`shrink-0 font-extrabold ${met ? "text-emerald-300" : "text-straw"}`}>+{formatNumber(objective.berrys)} ฿</span>
              </p>
              {!met && progress > 0 && (
                <div
                  role="progressbar"
                  aria-label={objective.label}
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
    </section>
  );
}

/** Rappel du parcours du joueur sur ce jeu : son meilleur résultat et ses parties. */
export function GameRecord({ slug }: { slug: LiveSlug }) {
  const { state, status } = usePlayer();
  const stats = state.stats[slug];
  if (status === "loading" || !stats || stats.games === 0) return null;
  return (
    <span className="inline-flex min-h-9 items-center text-sm font-bold text-mist">
      Ton record : {Math.round(stats.best * 100)} % des points · {formatNumber(stats.games)} partie{stats.games > 1 ? "s" : ""}
    </span>
  );
}
