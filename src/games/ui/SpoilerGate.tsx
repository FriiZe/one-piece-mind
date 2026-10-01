"use client";

import type { GameData } from "../cards";
import { formatNumber } from "../engine/text";
import { useLocale, useT } from "@/lib/i18n/client";
import type { SpoilerMode } from "@/lib/spoilers";

/** Question posée avant la première partie : où en est le joueur ? */
export function SpoilerGate({ data, onChoose }: { data: GameData; onChoose: (mode: SpoilerMode) => void }) {
  const t = useT();
  const locale = useLocale();
  const cutoff = formatNumber(data.animeCutoffChapter, locale);
  const latest = formatNumber(data.latestChapter, locale);
  const options: { mode: SpoilerMode; title: string; detail: string }[] = [
    {
      mode: "anime",
      title: t("Je suis à jour sur l'anime", "I'm caught up with the anime"),
      detail: t(`Rien au-delà du chapitre ${cutoff}, le dernier adapté.`, `Nothing past chapter ${cutoff}, the last one adapted.`),
    },
    {
      mode: "manga",
      title: t("Je suis à jour sur le manga", "I'm caught up with the manga"),
      detail: t(`Tout, jusqu'au chapitre ${latest}.`, `Everything, up to chapter ${latest}.`),
    },
  ];

  return (
    <div className="rounded-2xl bg-parchment p-5 text-ink sm:p-8">
      <h2 className="font-display text-3xl tracking-wide">{t("Où en es-tu ?", "How far along are you?")}</h2>
      <p className="mt-1">
        {t(
          "Les jeux ne te montreront rien que tu n'as pas encore vu. Tu pourras changer d'avis.",
          "The games won't show you anything you haven't seen yet. You can change your mind later.",
        )}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.mode}
            type="button"
            onClick={() => onChoose(option.mode)}
            className="rounded-xl border-2 border-ink/20 bg-white/60 p-4 text-left transition-colors hover:border-vest hover:bg-white"
          >
            <span className="block text-lg font-bold">{option.title}</span>
            <span className="mt-1 block text-sm">{option.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ModeBar({ mode, onChange }: { mode: SpoilerMode; onChange: (mode: SpoilerMode | null) => void }) {
  const t = useT();
  return (
    <p className="inline-flex min-h-9 flex-wrap items-center gap-x-2 rounded-full border border-sea-700 px-3.5 py-1 text-sm text-mist">
      <span>
        {t("Sans spoiler :", "Spoiler-free:")}{" "}
        <strong className="text-foam">
          {mode === "anime" ? t("à jour sur l'anime", "caught up with the anime") : t("à jour sur le manga", "caught up with the manga")}
        </strong>
      </span>
      <button type="button" onClick={() => onChange(null)} className="cursor-pointer font-bold text-straw underline underline-offset-4">
        {t("Changer", "Change")}
      </button>
    </p>
  );
}
