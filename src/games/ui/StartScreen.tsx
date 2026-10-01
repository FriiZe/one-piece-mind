"use client";

import type { ReactNode } from "react";
import { DIFFICULTIES, type Difficulty } from "../engine/difficulty";
import { Button, Panel } from "./primitives";
import { useStored } from "./storage";

/** Écran de départ : choix de la difficulté, mémorisé d'une partie à l'autre. */
export function StartScreen({
  children,
  onStart,
  startLabel = "Jouer",
}: {
  children?: ReactNode;
  onStart: (difficulty: Difficulty) => void;
  startLabel?: string;
}) {
  const [difficulty, setDifficulty] = useStored<Difficulty>("opm.difficulty", "normal");

  return (
    <Panel className="space-y-4">
      {children}
      <fieldset>
        <legend className="mb-2 font-bold text-foam">Difficulté</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {DIFFICULTIES.map((d) => (
            <label
              key={d.id}
              className={`cursor-pointer rounded-xl border-2 p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-straw ${
                difficulty === d.id ? "border-straw bg-straw/10" : "border-sea-600 hover:border-mist"
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
              <span className="block font-bold text-foam">{d.label}</span>
              <span className="block text-sm text-mist">{d.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button onClick={() => onStart(difficulty)}>{startLabel}</Button>
    </Panel>
  );
}
