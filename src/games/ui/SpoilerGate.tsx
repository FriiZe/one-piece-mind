"use client";

import type { GameData } from "../cards";
import { formatNumber } from "../engine/text";
import type { SpoilerMode } from "@/lib/spoilers";

const OPTIONS: { mode: SpoilerMode; title: string; detail: (data: GameData) => string }[] = [
  {
    mode: "anime",
    title: "Je suis à jour sur l'anime",
    detail: (data) => `Rien au-delà du chapitre ${formatNumber(data.animeCutoffChapter)}, le dernier adapté.`,
  },
  {
    mode: "manga",
    title: "Je suis à jour sur le manga",
    detail: (data) => `Tout, jusqu'au chapitre ${formatNumber(data.latestChapter)}.`,
  },
];

/** Question posée avant la première partie : où en est le joueur ? */
export function SpoilerGate({ data, onChoose }: { data: GameData; onChoose: (mode: SpoilerMode) => void }) {
  return (
    <div className="rounded-2xl bg-parchment p-5 text-ink sm:p-8">
      <h2 className="font-display text-3xl tracking-wide">Où en es-tu ?</h2>
      <p className="mt-1">Les jeux ne te montreront rien que tu n&apos;as pas encore vu. Tu pourras changer d&apos;avis.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <button
            key={option.mode}
            type="button"
            onClick={() => onChoose(option.mode)}
            className="rounded-xl border-2 border-ink/20 bg-white/60 p-4 text-left transition-colors hover:border-vest hover:bg-white"
          >
            <span className="block text-lg font-bold">{option.title}</span>
            <span className="mt-1 block text-sm">{option.detail(data)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ModeBar({ mode, onChange }: { mode: SpoilerMode; onChange: (mode: SpoilerMode | null) => void }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mist">
      <span>
        Mode sans spoiler : <strong className="text-foam">{mode === "anime" ? "à jour sur l'anime" : "à jour sur le manga"}</strong>
      </span>
      <button type="button" onClick={() => onChange(null)} className="underline underline-offset-4 hover:text-foam">
        Changer
      </button>
    </p>
  );
}
