"use client";

import { useMemo, useState } from "react";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Portrait } from "../ui/Portrait";
import { Button, Correction, Panel, Progress } from "../ui/primitives";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import { useT } from "@/lib/i18n/client";
import { generateRounds, isCorrect } from "./logic";

type Progression = {
  index: number;
  /** Réponse retenue pour chaque manche terminée : le nom trouvé, ou une chaîne vide. */
  answers: string[];
  /** La dernière saisie était fausse. */
  missed: boolean;
  /** La manche en cours est terminée (trouvée ou passée). */
  done: boolean;
  score: number;
};
const START: Progression = { index: 0, answers: [], missed: false, done: false, score: 0 };

export default function Anagramme({ data }: GameProps) {
  const t = useT();
  const base = useRun("anagramme");
  const [state, setState] = useState<Progression>(START);
  const [input, setInput] = useState("");
  const game = {
    ...base,
    start: (difficulty: Parameters<typeof base.start>[0]) => {
      setState(START);
      setInput("");
      base.start(difficulty);
    },
  };
  const { run, finished } = base;

  const rounds = useMemo(() => (run ? generateRounds(run.seed, run.difficulty, data.characters) : []), [run, data.characters]);

  if (!run || !rounds.length) {
    return (
      <GameStart game={game}>
        <p className="text-mist">
          {t(
            "Huit noms dont les lettres ont été mélangées. Remets-les dans l'ordre.",
            "Eight names with their letters scrambled. Put them back in order.",
          )}
        </p>
      </GameStart>
    );
  }
  if (finished) return <GameEnd game={game} data={data} max={rounds.length} />;

  const round = rounds[state.index];
  const last = state.index === rounds.length - 1;
  const found = state.done && state.answers[state.index] !== "";

  function answer() {
    if (state.done || !input.trim()) return;
    if (isCorrect(round, input)) {
      setState({ ...state, answers: [...state.answers, input], missed: false, done: true, score: state.score + 1 });
    } else {
      setState({ ...state, missed: true });
    }
  }

  function next() {
    if (!run) return;
    if (last) {
      game.finish(state.score);
      game.reward.submit({ slug: "anagramme", seed: run.seed, mode: data.mode, difficulty: run.difficulty, answers: state.answers });
      return;
    }
    setInput("");
    setState({ ...state, index: state.index + 1, missed: false, done: false });
  }

  return (
    <Panel className="space-y-4">
      <Progress
        current={state.index + 1}
        total={rounds.length}
        score={t(`Score : ${state.score}`, `Score: ${state.score}`)}
      />
      <p
        className="flex flex-wrap justify-center gap-1.5"
        aria-label={t(
          `Lettres mélangées : ${[...round.letters].join(" ")}`,
          `Scrambled letters: ${[...round.letters].join(" ")}`,
        )}
      >
        {[...round.letters].map((letter, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="flex h-11 w-9 items-center justify-center rounded-lg bg-parchment font-display text-2xl text-ink sm:h-12 sm:w-10"
          >
            {letter}
          </span>
        ))}
      </p>
      {round.target.affiliation && (
        <p className="text-center text-sm text-mist">
          {t("Indice : ", "Hint: ")}
          {round.target.affiliation}
        </p>
      )}

      {!state.done ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            answer();
          }}
        >
          <label htmlFor="anagramme-saisie" className="sr-only">
            {t("Ta réponse", "Your answer")}
          </label>
          <input
            id="anagramme-saisie"
            type="text"
            // Le champ réapparaît à chaque manche : il reprend la main sans clic
            autoFocus
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={t("Ta réponse…", "Your answer…")}
            className="min-w-0 flex-1 rounded-lg border-2 border-sea-600 bg-sea-900 px-4 py-3 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none"
          />
          <Button type="submit">{t("Valider", "Submit")}</Button>
          <Button
            variant="secondary"
            onClick={() => setState({ ...state, answers: [...state.answers, ""], missed: false, done: true })}
          >
            {t("Passer", "Skip")}
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          {round.target.img && <Portrait img={round.target.img} />}
          {/* Entrée valide une réponse, puis passe à la manche suivante */}
          <Correction
            live={false}
            action={
              <Button autoFocus onClick={next}>
                {last ? t("Voir mon score", "See my score") : t("Suivant", "Next")}
              </Button>
            }
          >
            <p className={`font-bold ${found ? "text-emerald-300" : "text-vest"}`}>
              {found
                ? t(`${round.target.name} : +1 point.`, `${round.target.name}: +1 point.`)
                : t(`C'était ${round.target.name}.`, `It was ${round.target.name}.`)}
            </p>
          </Correction>
        </div>
      )}
      <p className="min-h-6 text-sm font-semibold text-vest" aria-live="polite">
        {state.missed && !state.done
          ? t("Ce n'est pas ça. Essaie encore, ou passe.", "That's not it. Try again, or skip.")
          : ""}
      </p>
    </Panel>
  );
}
