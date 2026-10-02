"use client";

import { useMemo, useState } from "react";
import type { PlayCharacter } from "../cards";
import { CharacterSearch } from "../ui/CharacterSearch";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Portrait } from "../ui/Portrait";
import { Button, Progress } from "../ui/primitives";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import type { Localized } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { generateRounds, maxPoints, pointsFor, usesDifficulty, type ClueEvent, type ClueSlug } from "./logic";

const INTROS: Record<ClueSlug, Localized> = {
  "les-indices": {
    fr: "Cinq personnages à retrouver. Les indices vont du plus vague au plus précis : moins tu en utilises, plus tu marques.",
    en: "Five characters to identify. The clues go from vaguest to most precise: the fewer you use, the more you score.",
  },
  emojis: {
    fr: "Cinq personnages résumés en quelques emojis. Chaque erreur dévoile un indice supplémentaire.",
    en: "Five characters summed up in a few emojis. Each wrong guess reveals one more clue.",
  },
};

type Progression = {
  index: number;
  revealed: number;
  wrong: string[];
  log: ClueEvent[][];
  /** Points gagnés sur la manche en cours, `null` tant qu'elle est en jeu. */
  outcome: number | null;
  score: number;
};
const START: Progression = { index: 0, revealed: 1, wrong: [], log: [[]], outcome: null, score: 0 };

export default function ClueGame({ data, slug }: GameProps & { slug: ClueSlug }) {
  const t = useT();
  const locale = useLocale();
  const base = useRun(slug);
  const [state, setState] = useState<Progression>(START);
  const game = {
    ...base,
    start: (difficulty: Parameters<typeof base.start>[0]) => {
      setState(START);
      base.start(difficulty);
    },
  };
  const { run, finished } = base;
  const withDifficulty = usesDifficulty(slug);

  const rounds = useMemo(() => (run ? generateRounds(slug, run.seed, run.difficulty, data) : []), [slug, run, data]);

  if (!run || !rounds.length) {
    return (
      <GameStart game={game} withDifficulty={withDifficulty}>
        <p className="text-mist">{INTROS[slug][locale]}</p>
      </GameStart>
    );
  }
  if (finished) return <GameEnd game={game} data={data} max={rounds.length * maxPoints(slug)} withDifficulty={withDifficulty} />;

  const round = rounds[state.index];
  const worth = pointsFor(slug, state.revealed, round.clues.length);
  const done = state.outcome !== null;
  const last = state.index === rounds.length - 1;
  const logged = (event: ClueEvent) => state.log.map((events, i) => (i === state.index ? [...events, event] : events));

  function guess(character: PlayCharacter) {
    if (done) return;
    const log = logged({ type: "guess", id: character.id });
    if (character.id === round.target.id) {
      setState({ ...state, log, outcome: worth, score: state.score + worth });
      return;
    }
    const wrong = [...state.wrong, character.id];
    if (state.revealed >= round.clues.length) setState({ ...state, log, wrong, outcome: 0 });
    else setState({ ...state, log, wrong, revealed: state.revealed + 1 });
  }

  function next() {
    if (!run) return;
    if (last) {
      game.finish(state.score);
      game.reward.submit({ slug, seed: run.seed, mode: data.mode, difficulty: run.difficulty, rounds: state.log });
      return;
    }
    setState({ ...state, index: state.index + 1, revealed: 1, wrong: [], log: [...state.log, []], outcome: null });
  }

  return (
    <div className="space-y-4">
      <Progress
        current={state.index + 1}
        total={rounds.length}
        score={t(`Score : ${state.score}`, `Score: ${state.score}`)}
      />
      <ul className="space-y-2" aria-label={t("Indices", "Clues")} aria-live="polite">
        {round.clues.map((clue, i) => {
          const shown = i < state.revealed || done;
          return (
            <li key={clue.title} className="rounded-lg border border-sea-600 bg-sea-800/70 px-3 py-2">
              <span className="block text-xs font-semibold tracking-wide text-mist uppercase">{clue.title}</span>
              <span className={clue.big ? "block text-center text-5xl leading-snug" : "font-bold text-foam"}>
                {shown ? clue.value : "· · ·"}
              </span>
            </li>
          );
        })}
      </ul>

      {!done && (
        <>
          <CharacterSearch
            characters={data.characters}
            excludeIds={new Set(state.wrong)}
            onPick={guess}
            label={t("Qui est-ce ?", "Who is it?")}
            placeholder={t("Qui est-ce ?", "Who is it?")}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-mist">
            <span>
              {t(
                `Cette manche vaut encore ${worth} point${worth > 1 ? "s" : ""}.`,
                `This round is still worth ${worth} point${worth === 1 ? "" : "s"}.`,
              )}
            </span>
            <span className="flex gap-4">
              {state.revealed < round.clues.length && (
                <button
                  type="button"
                  className="underline underline-offset-4 hover:text-foam"
                  onClick={() => setState({ ...state, log: logged({ type: "hint" }), revealed: state.revealed + 1 })}
                >
                  {t("Un indice", "Clue")}
                </button>
              )}
              <button
                type="button"
                className="underline underline-offset-4 hover:text-foam"
                onClick={() => setState({ ...state, log: logged({ type: "pass" }), outcome: 0 })}
              >
                {t("Passer", "Skip")}
              </button>
            </span>
          </div>
        </>
      )}

      {done && round.target.img && <Portrait img={round.target.img} />}
      {done && (
        <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
          <p className={`font-bold ${state.outcome ? "text-emerald-300" : "text-vest"}`}>
            {state.outcome
              ? t(
                  `${round.target.name} : +${state.outcome} point${state.outcome > 1 ? "s" : ""}.`,
                  `${round.target.name}: +${state.outcome} point${state.outcome === 1 ? "" : "s"}.`,
                )
              : t(`C'était ${round.target.name}.`, `It was ${round.target.name}.`)}
          </p>
          <Button autoFocus onClick={next}>
            {last ? t("Voir mon score", "See my score") : t("Manche suivante", "Next round")}
          </Button>
        </div>
      )}
    </div>
  );
}
