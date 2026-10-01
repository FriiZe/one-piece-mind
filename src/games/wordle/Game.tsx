"use client";

import { useMemo, useState } from "react";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Portrait } from "../ui/Portrait";
import { Button, Panel } from "../ui/primitives";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import { feedback, isValidGuess, MAX_TRIES, targetOf, toWord, type LetterState } from "./logic";

const TONES: Record<LetterState, string> = {
  exact: "bg-emerald-600 text-white border-emerald-600",
  present: "bg-amber-500 text-ink border-amber-500",
  absent: "bg-sea-700 text-mist border-sea-700",
};
const STATE_LABELS: Record<LetterState, string> = { exact: "bien placée", present: "mal placée", absent: "absente" };

export default function Wordle({ data }: GameProps) {
  const base = useRun("wordle");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const game = {
    ...base,
    start: (difficulty: Parameters<typeof base.start>[0]) => {
      setGuesses([]);
      setInput("");
      base.start(difficulty);
    },
  };
  const { run, finished } = base;

  const character = useMemo(
    () => (run ? targetOf(run.seed, run.difficulty, data.characters) : null),
    [run, data.characters],
  );

  if (!run || !character) {
    return (
      <GameStart game={game}>
        <p className="text-mist">
          Un nom de personnage à trouver en six essais. Après chaque essai, les lettres bien placées passent au vert, les
          lettres mal placées à l&apos;orange.
        </p>
      </GameStart>
    );
  }

  const target = toWord(character.name);
  const won = guesses.includes(target);
  const over = won || guesses.length >= MAX_TRIES;
  const word = toWord(input);

  if (finished) {
    return (
      <GameEnd game={game} data={data} max={MAX_TRIES}>
        {character.img && <Portrait img={character.img} className="h-32 w-24" />}
        <p>{won ? `${character.name} trouvé en ${guesses.length} essai${guesses.length > 1 ? "s" : ""}.` : `C'était ${character.name}.`}</p>
      </GameEnd>
    );
  }

  function submit() {
    if (!run || over || !isValidGuess(word, target)) return;
    const next = [...guesses, word];
    setGuesses(next);
    setInput("");
    if (word === target || next.length >= MAX_TRIES) {
      game.finish(word === target ? MAX_TRIES + 1 - next.length : 0);
      game.reward.submit({ slug: "wordle", seed: run.seed, mode: data.mode, difficulty: run.difficulty, guesses: next });
    }
  }

  return (
    <Panel className="space-y-4">
      <p className="text-sm text-mist">
        Un nom de {target.length} lettres · essai {Math.min(guesses.length + 1, MAX_TRIES)} sur {MAX_TRIES}
        {guesses.length >= 3 && character.affiliation ? ` · indice : ${character.affiliation}` : ""}
      </p>
      <div className="mx-auto grid w-fit gap-1.5" role="grid" aria-label="Essais">
        {Array.from({ length: MAX_TRIES }, (_, row) => {
          const guess = guesses[row];
          const states = guess ? feedback(guess, target) : null;
          return (
            <div key={row} role="row" className="flex gap-1.5">
              {Array.from({ length: target.length }, (_, column) => (
                <span
                  key={column}
                  role="gridcell"
                  aria-label={guess ? `${guess[column]}, ${STATE_LABELS[states![column]]}` : "vide"}
                  className={`flex h-11 w-9 items-center justify-center rounded-lg border-2 font-display text-2xl sm:h-12 sm:w-11 ${
                    states ? TONES[states[column]] : "border-sea-600 text-foam"
                  }`}
                >
                  {guess?.[column] ?? ""}
                </span>
              ))}
            </div>
          );
        })}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor="wordle-saisie" className="sr-only">
          Ton essai
        </label>
        <input
          id="wordle-saisie"
          type="text"
          value={input}
          maxLength={target.length}
          onChange={(event) => setInput(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={`${target.length} lettres…`}
          className="min-w-0 flex-1 rounded-lg border-2 border-sea-600 bg-sea-900 px-4 py-3 text-foam uppercase placeholder:text-mist/70 placeholder:normal-case focus:border-straw focus:outline-none"
        />
        <Button type="submit" disabled={!isValidGuess(word, target)}>
          Valider
        </Button>
      </form>
    </Panel>
  );
}
