"use client";

import { formatNumber } from "@/games/engine/text";
import { isMet, objectiveProgress, OBJECTIVES } from "@/lib/economy";
import type { LiveSlug } from "@/lib/games/catalog";
import { usePlayer } from "@/lib/player/PlayerProvider";

/** Objectifs du jeu affiché, avec l'avancement du joueur. */
export function GameObjectives({ slug }: { slug: LiveSlug }) {
  const { state, status } = usePlayer();
  const stats = state.stats[slug];
  const reached = OBJECTIVES.filter((objective) => isMet(objective, stats)).length;

  return (
    <section aria-labelledby="objectifs" className="space-y-3">
      <h2 id="objectifs" className="font-display text-3xl tracking-wide text-straw">
        Objectifs{" "}
        <span className={`font-sans text-base font-semibold text-mist ${status === "loading" ? "invisible" : ""}`}>
          · {reached} sur {OBJECTIVES.length}
        </span>
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {OBJECTIVES.map((objective) => {
          const met = isMet(objective, stats);
          const progress = objectiveProgress(objective, stats);
          return (
            <li
              key={objective.id}
              className={`rounded-xl border p-3 ${met ? "border-emerald-400/60 bg-emerald-600/10" : "border-sea-700 bg-sea-800/70"}`}
            >
              <p className="flex items-start justify-between gap-2 font-bold text-foam">
                <span>
                  {met && <span aria-hidden="true">✓ </span>}
                  {objective.label}
                  {met && <span className="sr-only"> (atteint)</span>}
                </span>
                <span className="shrink-0 text-sm text-straw">+{formatNumber(objective.berrys)} ฿</span>
              </p>
              <div
                role="progressbar"
                aria-label={objective.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-sea-700"
              >
                <div className={`h-full ${met ? "bg-emerald-400" : "bg-straw"}`} style={{ width: `${progress * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
