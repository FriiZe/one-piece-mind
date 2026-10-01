"use client";

import { useState, type PointerEvent } from "react";
import { formatNumber } from "@/games/engine/text";
import { axisTicks } from "@/lib/admin/format";
import { useLocale, useT } from "@/lib/i18n/client";

export type DayPoint = {
  /** Jour en clair pour l'axe (« 1 oct. ») et pour l'infobulle (« jeudi 1 octobre »). */
  short: string;
  long: string;
  value: number;
};

/**
 * Un nombre par jour, en colonnes. Une seule série : le titre dit ce qui est
 * compté, `summary` en donne le total sur la période. Le survol donne la
 * valeur d'un jour ; le tableau replié sous le graphique donne les mêmes
 * chiffres sans souris.
 */
export function DayChart({ title, summary, points }: { title: string; summary: string; points: DayPoint[] }) {
  const t = useT();
  const locale = useLocale();
  const [active, setActive] = useState<number | null>(null);

  const ticks = axisTicks(Math.max(...points.map((point) => point.value)));
  const top = ticks.at(-1)!;
  const hovered = active === null ? null : points[active];
  // Repères de l'axe des jours : le premier, celui du milieu, le dernier
  const marks = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  // Le pointeur désigne le jour le plus proche : pas besoin de viser une colonne étroite
  const track = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.floor(((event.clientX - box.left) / box.width) * points.length);
    setActive(Math.min(points.length - 1, Math.max(0, index)));
  };

  return (
    <figure className="rounded-2xl border border-sea-700 bg-sea-800 p-4 sm:p-5">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-extrabold text-foam">{title}</span>
        <span className="text-sm text-mist">{summary}</span>
      </figcaption>

      <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5">
        <div aria-hidden="true" className="relative h-40 text-right text-xs text-mist tabular-nums">
          {/* La graduation la plus large fixe la largeur de la colonne */}
          <span className="invisible">{formatNumber(top, locale)}</span>
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: `${(tick / top) * 100}%` }}>
              {formatNumber(tick, locale)}
            </span>
          ))}
        </div>

        <div
          role="img"
          aria-label={t(
            `${title}, du ${points[0].long} au ${points.at(-1)!.long} : ${summary}`,
            `${title}, from ${points[0].long} to ${points.at(-1)!.long}: ${summary}`,
          )}
          className="relative h-40 touch-pan-y"
          onPointerMove={track}
          onPointerDown={track}
          onPointerLeave={() => setActive(null)}
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className={`absolute inset-x-0 h-px ${tick === 0 ? "bg-sea-600" : "bg-sea-700"}`}
              style={{ bottom: `${(tick / top) * 100}%` }}
            />
          ))}
          <div className={`absolute inset-0 flex items-end ${points.length > 45 ? "gap-px" : "gap-0.5"}`}>
            {points.map((point, index) => (
              <span key={index} className="flex h-full min-w-0 flex-1 items-end justify-center">
                <span
                  className={`w-full max-w-6 rounded-t-[4px] ${index === active ? "bg-straw" : "bg-[#b98a22]"}`}
                  // Un jour non nul reste visible, même tout petit à côté du maximum
                  style={{ height: point.value ? `max(2px, ${(point.value / top) * 100}%)` : 0 }}
                />
              </span>
            ))}
          </div>
          {hovered && active !== null && (
            <div
              className="pointer-events-none absolute bottom-full z-10 mb-1 -translate-x-1/2 rounded-lg border border-sea-600 bg-sea-950 px-2.5 py-1.5 text-center whitespace-nowrap shadow-lg"
              style={{ left: `clamp(70px, ${((active + 0.5) / points.length) * 100}%, calc(100% - 70px))` }}
            >
              <p className="font-extrabold text-foam">{formatNumber(hovered.value, locale)}</p>
              <p className="text-xs text-mist">{hovered.long}</p>
            </div>
          )}
        </div>

        <div aria-hidden="true" className="relative col-start-2 mt-1.5 h-4 text-xs text-mist">
          {marks.map((index, position) => (
            <span
              key={index}
              className={`absolute whitespace-nowrap ${position === 0 ? "left-0" : position === 2 ? "right-0" : "-translate-x-1/2"}`}
              style={position === 1 ? { left: `${((index + 0.5) / points.length) * 100}%` } : undefined}
            >
              {points[index].short}
            </span>
          ))}
        </div>
      </div>

      <details className="mt-3 text-sm text-mist">
        <summary className="cursor-pointer font-bold hover:text-foam">{t("Voir les chiffres", "Show the numbers")}</summary>
        <div className="mt-2 max-h-56 overflow-y-auto">
          <table className="w-full tabular-nums">
            <thead className="sr-only">
              <tr>
                <th scope="col">{t("Jour", "Day")}</th>
                <th scope="col">{title}</th>
              </tr>
            </thead>
            <tbody>
              {points.toReversed().map((point) => (
                <tr key={point.long} className="border-t border-sea-700">
                  <th scope="row" className="py-1 text-left font-normal">
                    {point.long}
                  </th>
                  <td className="py-1 text-right text-foam">{formatNumber(point.value, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
