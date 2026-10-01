"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { portraitUrl, type PlayCharacter } from "../cards";
import { CharacterSearch } from "../ui/CharacterSearch";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Button, Panel } from "../ui/primitives";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import { useT } from "@/lib/i18n/client";
import { CELLS, exampleFor, fits, generate, SIZE } from "./logic";

const NO_ANSWERS: (string | null)[] = Array(CELLS).fill(null);

export default function Grille({ data }: GameProps) {
  const t = useT();
  const base = useRun("grille");
  /** Réponse donnée dans chaque case ; `null` tant qu'elle n'a pas été tentée. */
  const [answers, setAnswers] = useState<(string | null)[]>(NO_ANSWERS);
  const [active, setActive] = useState<number | null>(null);
  const [stopped, setStopped] = useState(false);
  const game = {
    ...base,
    start: (difficulty: Parameters<typeof base.start>[0]) => {
      setAnswers(NO_ANSWERS);
      setActive(null);
      setStopped(false);
      base.start(difficulty);
    },
  };
  const { run, finished } = base;

  const grid = useMemo(() => (run ? generate(run.seed, run.difficulty, data) : null), [run, data]);

  if (!run || !grid) {
    return (
      <GameStart game={game}>
        <p className="text-mist">
          {t(
            "Neuf cases, chacune au croisement de deux critères. Donne pour chaque case un personnage qui remplit les deux : tu n'as qu'un essai par case, et un personnage ne sert qu'une fois.",
            "Nine squares, each where two criteria cross. For each square, name a character who meets both: you only get one try per square, and each character can only be used once.",
          )}
        </p>
      </GameStart>
    );
  }

  const used = new Set(answers.filter((id): id is string => id !== null));
  const right = answers.map((id, cell) => !!id && fits(grid, cell, data.characterById.get(id)!));
  const score = right.filter(Boolean).length;
  const over = stopped || answers.every((id) => id !== null);

  if (finished) return <GameEnd game={game} data={data} max={CELLS} />;

  function answer(character: PlayCharacter) {
    if (active === null || answers[active] !== null) return;
    setAnswers(answers.map((id, cell) => (cell === active ? character.id : id)));
    setActive(null);
  }

  function finish() {
    if (!run) return;
    game.finish(score);
    game.reward.submit({ slug: "grille", seed: run.seed, mode: data.mode, difficulty: run.difficulty, answers });
  }

  const row = active === null ? null : grid.rows[Math.floor(active / SIZE)];
  const column = active === null ? null : grid.columns[active % SIZE];

  return (
    <Panel className="space-y-4">
      <p className="text-sm font-semibold text-mist">
        {t("Score : ", "Score: ")}
        {score} / {CELLS}
      </p>

      <div className="grid grid-cols-[minmax(4.5rem,1fr)_repeat(3,minmax(0,1.3fr))] gap-1.5 sm:gap-2">
        <span />
        {grid.columns.map((criterion) => (
          <p key={criterion.id} className="flex items-end justify-center pb-1 text-center text-xs leading-tight font-bold text-straw sm:text-sm">
            {criterion.label}
          </p>
        ))}
        {grid.rows.map((criterion, r) => [
          <p key={criterion.id} className="flex items-center text-xs leading-tight font-bold text-straw sm:text-sm">
            {criterion.label}
          </p>,
          ...grid.columns.map((_, c) => {
            const cell = r * SIZE + c;
            const id = answers[cell];
            const character = id ? data.characterById.get(id) : null;
            // Partie arrêtée : une case vide ou ratée montre une réponse qui convenait
            const example = over && !right[cell] ? exampleFor(grid, cell, data, used) : null;
            const shown = character ?? example;
            const tone = character
              ? right[cell]
                ? "border-emerald-400 bg-emerald-600/25"
                : "border-vest bg-vest/25"
              : active === cell
                ? "border-straw bg-straw/20"
                : "border-sea-600 bg-sea-700 hover:border-mist";
            return (
              <button
                key={cell}
                type="button"
                disabled={!!id || over}
                aria-pressed={active === cell}
                aria-label={t(
                  `Case ${grid.rows[r].label} et ${grid.columns[c].label}${character ? ` : ${character.name}` : ""}`,
                  `Square ${grid.rows[r].label} and ${grid.columns[c].label}${character ? `: ${character.name}` : ""}`,
                )}
                onClick={() => setActive(cell)}
                className={`flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 p-1 text-center transition-colors disabled:cursor-default ${tone}`}
              >
                {shown?.img && (
                  <span className="relative block h-3/5 w-3/5 overflow-hidden rounded-lg">
                    <Image src={portraitUrl(shown.img)} alt="" fill sizes="96px" className="object-cover object-top" />
                  </span>
                )}
                <span className="text-[0.7rem] leading-tight font-bold break-words text-foam sm:text-xs">
                  {character
                    ? `${right[cell] ? "✓" : "✗"} ${character.name}`
                    : example
                      ? t(`Par exemple : ${example.name}`, `For example: ${example.name}`)
                      : active === cell
                        ? "…"
                        : "?"}
                </span>
              </button>
            );
          }),
        ])}
      </div>

      {over ? (
        <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
          <p className="font-bold text-foam">
            {score === CELLS
              ? t("Grille complète !", "Grid complete!")
              : t(
                  `${score} case${score > 1 ? "s" : ""} sur ${CELLS}.`,
                  `${score} ${score === 1 ? "square" : "squares"} out of ${CELLS}.`,
                )}
          </p>
          <Button autoFocus onClick={finish}>
            {t("Voir mon score", "See my score")}
          </Button>
        </div>
      ) : active === null || !row || !column ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-mist">
            {t(
              "Choisis une case, puis donne un personnage qui remplit ses deux critères.",
              "Pick a square, then name a character who meets both of its criteria.",
            )}
          </p>
          <Button variant="secondary" onClick={() => setStopped(true)}>
            {t("Arrêter là", "Stop here")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="font-semibold text-foam">
            {row.label} <span className="text-mist">{t("et", "and")}</span> {column.label}
          </p>
          <CharacterSearch
            key={active}
            characters={data.characters}
            excludeIds={used}
            onPick={answer}
            label={t("Personnage pour cette case", "Character for this square")}
            placeholder={t("Qui remplit cette case ?", "Who fits this square?")}
          />
        </div>
      )}
    </Panel>
  );
}
