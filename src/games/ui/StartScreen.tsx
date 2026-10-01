"use client";

import type { ReactNode } from "react";
import { DIFFICULTIES, type Difficulty } from "../engine/difficulty";
import { useLocale, useT } from "@/lib/i18n/client";
import { Button, Panel } from "./primitives";
import { useStored } from "./storage";

/** Écran de départ : choix de la difficulté, mémorisé d'une partie à l'autre. */
export function StartScreen({
  children,
  onStart,
  startLabel,
}: {
  children?: ReactNode;
  onStart: (difficulty: Difficulty) => void;
  startLabel?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [difficulty, setDifficulty] = useStored<Difficulty>("opm.difficulty", "normal");

  const current = DIFFICULTIES.find((d) => d.id === difficulty) ?? DIFFICULTIES[0];

  return (
    <Panel className="space-y-5">
      {children}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-bold text-mist">{t("Difficulté", "Difficulty")}</legend>
        <div className="grid grid-cols-3 rounded-xl border border-sea-700 bg-sea-900 p-1">
          {DIFFICULTIES.map((d) => (
            <label
              key={d.id}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-[9px] text-[15px] font-extrabold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-straw ${
                difficulty === d.id ? "bg-straw text-ink" : "text-mist hover:text-foam"
              }`}
            >
              <input
                type="radio"
                name="difficulte"
                value={d.id}
                checked={difficulty === d.id}
                onChange={() => setDifficulty(d.id)}
                className="sr-only"
              />
              {d.label[locale]}
            </label>
          ))}
        </div>
        <p className="text-sm text-mist" aria-live="polite">
          {current.label[locale]}
          {t(" : ", ": ")}
          {current.hint[locale].charAt(0).toLowerCase() + current.hint[locale].slice(1)}
        </p>
      </fieldset>
      <Button onClick={() => onStart(difficulty)} className="min-h-14 w-full text-lg">
        {startLabel ?? t("Jouer", "Play")}
      </Button>
    </Panel>
  );
}
