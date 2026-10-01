"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { portraitUrl } from "../cards";
import { createRng, shuffle } from "../engine/rng";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Button, Panel } from "../ui/primitives";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import { useT } from "@/lib/i18n/client";
import { generate, GROUP_SIZE, GROUPS, groupOf, MAX_MISTAKES, oneAway, replay } from "./logic";

/** Une couleur par famille, dans l'ordre où elles sont trouvées. */
const TONES = ["bg-straw text-ink", "bg-emerald-400 text-ink", "bg-sky-400 text-ink", "bg-violet-400 text-ink"];

export default function Connexions({ data }: GameProps) {
  const t = useT();
  const base = useRun("connexions");
  const [guesses, setGuesses] = useState<string[][]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [shuffles, setShuffles] = useState(0);
  const [note, setNote] = useState("");
  const game = {
    ...base,
    start: (difficulty: Parameters<typeof base.start>[0]) => {
      setGuesses([]);
      setSelected([]);
      setShuffles(0);
      setNote("");
      base.start(difficulty);
    },
  };
  const { run, finished } = base;

  const puzzle = useMemo(() => (run ? generate(run.seed, run.difficulty, data) : null), [run, data]);
  // Le bouton « Mélanger » redistribue les tuiles sans rien changer à l'énigme
  const tiles = useMemo(
    () => (puzzle && run ? (shuffles ? shuffle(createRng(run.seed + shuffles), puzzle.tiles) : puzzle.tiles) : []),
    [puzzle, run, shuffles],
  );

  if (!run || !puzzle) {
    return (
      <GameStart game={game}>
        <p className="text-mist">
          {t(
            "Seize personnages, quatre familles de quatre : un équipage, une mer d'origine, un type de fruit… Retrouve les quatre familles avant ta quatrième erreur.",
            "Sixteen characters, four groups of four: a crew, a home sea, a fruit type… Find all four groups before your fourth mistake.",
          )}
        </p>
      </GameStart>
    );
  }
  if (finished) return <GameEnd game={game} data={data} max={GROUPS} />;

  const state = replay(puzzle, guesses);
  const foundGroups = state.found.map((id) => puzzle.groups.find((group) => group.id === id)!);
  const solved = new Set(foundGroups.flatMap((group) => group.memberIds));
  // Partie terminée : les familles restantes sont dévoilées à la suite des trouvées
  const shownGroups = state.over ? [...foundGroups, ...puzzle.groups.filter((group) => !state.found.includes(group.id))] : foundGroups;
  const remaining = state.over ? [] : tiles.filter((tile) => !solved.has(tile.id));

  function toggle(id: string) {
    setNote("");
    setSelected((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : current.length < GROUP_SIZE ? [...current, id] : current,
    );
  }

  function submit() {
    if (selected.length !== GROUP_SIZE || state.over) return;
    const already = guesses.some((guess) => guess.length === selected.length && guess.every((id) => selected.includes(id)));
    if (already) {
      setNote(t("Tu as déjà essayé ce groupe.", "You've already tried those four."));
      return;
    }
    const group = groupOf(puzzle!, selected);
    setGuesses([...guesses, selected]);
    setSelected([]);
    setNote(
      group
        ? t(`Trouvé : ${group.label}.`, `Got it: ${group.label}.`)
        : oneAway(puzzle!, selected)
          ? t("Presque : un seul n'est pas à sa place.", "So close: just one doesn't belong.")
          : t("Ce n'est pas une famille.", "That's not a group."),
    );
  }

  function finish() {
    if (!run) return;
    game.finish(state.found.length);
    game.reward.submit({ slug: "connexions", seed: run.seed, mode: data.mode, difficulty: run.difficulty, guesses });
  }

  return (
    <Panel className="space-y-4">
      <div className="flex items-center justify-between text-sm font-semibold text-mist">
        <span>
          {state.found.length} / {GROUPS} {t("familles", "groups")}
        </span>
        <span
          aria-label={t(
            `${MAX_MISTAKES - state.mistakes} erreurs permises`,
            `${MAX_MISTAKES - state.mistakes} ${MAX_MISTAKES - state.mistakes === 1 ? "mistake" : "mistakes"} left`,
          )}
        >
          {t("Erreurs permises :", "Mistakes left:")}{" "}
          {Array.from({ length: MAX_MISTAKES }, (_, i) => (
            <span key={i} aria-hidden="true" className={i < MAX_MISTAKES - state.mistakes ? "text-straw" : "text-sea-600"}>
              ●
            </span>
          ))}
        </span>
      </div>

      {shownGroups.length > 0 && (
        <ul className="space-y-2">
          {shownGroups.map((group) => {
            const index = state.found.indexOf(group.id);
            return (
              <li key={group.id} className={`rounded-xl px-4 py-3 text-center ${index >= 0 ? TONES[index] : "bg-sea-600 text-foam"}`}>
                <p className="font-bold">
                  {index < 0 && t("Manquée : ", "Missed: ")}
                  {group.label}
                </p>
                <p className="text-sm">{group.memberIds.map((id) => data.characterById.get(id)?.name).join(" · ")}</p>
              </li>
            );
          })}
        </ul>
      )}

      {remaining.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {remaining.map((tile) => {
            const chosen = selected.includes(tile.id);
            return (
              <li key={tile.id}>
                <button
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => toggle(tile.id)}
                  className={`flex h-full w-full flex-col items-center gap-1 rounded-xl border-2 p-1.5 text-center transition-colors sm:p-2 ${
                    chosen ? "border-straw bg-straw/25" : "border-sea-600 bg-sea-700 hover:border-mist"
                  }`}
                >
                  {tile.img && (
                    <span className="relative block aspect-square w-full overflow-hidden rounded-lg">
                      <Image src={portraitUrl(tile.img)} alt="" fill sizes="120px" className="object-cover object-top" />
                    </span>
                  )}
                  <span className="text-xs leading-tight font-bold break-words text-foam sm:text-sm">{tile.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="min-h-6 text-center font-semibold text-foam" aria-live="polite">
        {note}
      </p>

      {state.over ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`font-bold ${state.found.length === GROUPS ? "text-emerald-300" : "text-vest"}`}>
            {state.found.length === GROUPS
              ? t("Les quatre familles sont trouvées.", "All four groups found.")
              : t("Quatre erreurs : la partie s'arrête là.", "Four mistakes: the game ends here.")}
          </p>
          <Button autoFocus onClick={finish}>
            {t("Voir mon score", "See my score")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={submit} disabled={selected.length !== GROUP_SIZE}>
            {t("Valider", "Submit")} ({selected.length} / {GROUP_SIZE})
          </Button>
          <Button variant="secondary" onClick={() => setSelected([])} disabled={selected.length === 0}>
            {t("Tout désélectionner", "Deselect all")}
          </Button>
          <Button variant="secondary" onClick={() => setShuffles(shuffles + 1)}>
            {t("Mélanger", "Shuffle")}
          </Button>
        </div>
      )}
    </Panel>
  );
}
