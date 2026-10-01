"use client";

import { useMemo, useState } from "react";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Portrait } from "../ui/Portrait";
import { Button, Panel } from "../ui/primitives";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import type { Localized } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { feedback, isValidGuess, MAX_TRIES, targetOf, toWord, type LetterState } from "./logic";

const TONES: Record<LetterState, string> = {
  exact: "bg-emerald-600 text-white border-emerald-600",
  present: "bg-amber-500 text-ink border-amber-500",
  absent: "bg-sea-700 text-mist border-sea-700",
};
const STATE_LABELS: Localized<Record<LetterState, string>> = {
  fr: { exact: "bien placée", present: "mal placée", absent: "absente" },
  en: { exact: "right spot", present: "wrong spot", absent: "not in the name" },
};

export default function Wordle({ data }: GameProps) {
  const t = useT();
  const locale = useLocale();
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
          {t(
            "Un nom de personnage à trouver en six essais. Après chaque essai, les lettres bien placées passent au vert, les lettres mal placées à l'orange.",
            "A character's name to find in six tries. After each try, letters in the right spot turn green and letters in the wrong spot turn orange.",
          )}
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
        <p>
          {won
            ? t(
                `${character.name} trouvé en ${guesses.length} essai${guesses.length > 1 ? "s" : ""}.`,
                `${character.name} found in ${guesses.length} ${guesses.length === 1 ? "try" : "tries"}.`,
              )
            : t(`C'était ${character.name}.`, `It was ${character.name}.`)}
        </p>
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
        {t(
          `Un nom de ${target.length} lettres · essai ${Math.min(guesses.length + 1, MAX_TRIES)} sur ${MAX_TRIES}`,
          `A ${target.length}-letter name · try ${Math.min(guesses.length + 1, MAX_TRIES)} of ${MAX_TRIES}`,
        )}
        {guesses.length >= 3 && character.affiliation
          ? t(` · indice : ${character.affiliation}`, ` · hint: ${character.affiliation}`)
          : ""}
      </p>
      <div className="mx-auto grid w-fit gap-1.5" role="grid" aria-label={t("Essais", "Tries")}>
        {Array.from({ length: MAX_TRIES }, (_, row) => {
          const guess = guesses[row];
          const states = guess ? feedback(guess, target) : null;
          return (
            <div key={row} role="row" className="flex gap-1.5">
              {Array.from({ length: target.length }, (_, column) => (
                <span
                  key={column}
                  role="gridcell"
                  aria-label={guess ? `${guess[column]}, ${STATE_LABELS[locale][states![column]]}` : t("vide", "empty")}
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
          {t("Ton essai", "Your guess")}
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
          placeholder={t(`${target.length} lettres…`, `${target.length} letters…`)}
          className="min-w-0 flex-1 rounded-lg border-2 border-sea-600 bg-sea-900 px-4 py-3 text-foam uppercase placeholder:text-mist/70 placeholder:normal-case focus:border-straw focus:outline-none"
        />
        <Button type="submit" disabled={!isValidGuess(word, target)}>
          {t("Valider", "Submit")}
        </Button>
      </form>
    </Panel>
  );
}
