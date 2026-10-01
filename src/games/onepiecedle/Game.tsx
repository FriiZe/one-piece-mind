"use client";

import { useMemo, useState } from "react";
import { resolveGameData, type PlayCharacter, type ResolvedData } from "../cards";
import { dailyNumber, isNextDay } from "../engine/daily";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, pick, randomSeed } from "../engine/rng";
import { CharacterSearch } from "../ui/CharacterSearch";
import { Button, Panel, ResultPanel, ShareButton } from "../ui/primitives";
import { StartScreen } from "../ui/StartScreen";
import { useDailyKey, useStored } from "../ui/storage";
import type { GameProps } from "../ui/types";
import { COLUMNS, compare, dailyTarget, eligible, shareGrid, type Cell } from "./logic";

const CELL_TONES = {
  exact: "bg-emerald-600 text-white",
  partial: "bg-amber-500 text-ink",
  wrong: "bg-vest-dark text-white",
} as const;

function Board({ rows }: { rows: { character: PlayCharacter; cells: Cell[] }[] }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-sea-700">
      <table className="w-full min-w-[46rem] border-separate border-spacing-1 text-center text-sm">
        <thead>
          <tr className="text-mist">
            <th scope="col" className="px-2 py-1 text-left font-semibold">
              Personnage
            </th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className="px-2 py-1 font-semibold">
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ character, cells }) => (
            <tr key={character.id}>
              <th scope="row" className="rounded-lg bg-sea-700 px-2 py-2 text-left font-bold text-foam">
                {character.name}
              </th>
              {cells.map((cell) => (
                <td key={cell.key} className={`rounded-lg px-2 py-2 font-semibold ${CELL_TONES[cell.verdict]}`}>
                  {cell.label}
                  {cell.direction && (
                    <span className="ml-1" role="img" aria-label={cell.direction === "up" ? "plus haut" : "plus bas"}>
                      {cell.direction === "up" ? "▲" : "▼"}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend() {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-mist">
      <span>
        <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-emerald-600" />
        Juste
      </span>
      <span>
        <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-amber-500" />
        En partie
      </span>
      <span>
        <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-vest-dark" />
        Faux
      </span>
      <span>▲ ▼ : la bonne valeur est plus haute ou plus basse (plus tard ou plus tôt pour l&apos;arc)</span>
    </p>
  );
}

/** Plateau commun aux deux modes : saisie, tableau des essais, écran de fin. */
function Play({
  data,
  target,
  guessIds,
  onGuess,
  gaveUp = false,
  footer,
}: {
  data: ResolvedData;
  target: PlayCharacter;
  guessIds: readonly string[];
  onGuess: (character: PlayCharacter) => void;
  gaveUp?: boolean;
  footer: (state: { won: boolean; rows: Cell[][] }) => React.ReactNode;
}) {
  const guesses = guessIds.map((id) => data.characterById.get(id)).filter((c): c is PlayCharacter => !!c);
  const rows = guesses.map((character) => ({ character, cells: compare(character, target, data) }));
  const won = guessIds.includes(target.id);
  const excluded = useMemo(() => new Set(guessIds), [guessIds]);

  return (
    <div className="space-y-4">
      {!won && !gaveUp && (
        <CharacterSearch
          characters={data.characters}
          excludeIds={excluded}
          onPick={onGuess}
          label="Proposer un personnage"
          placeholder="Propose un personnage…"
        />
      )}
      {footer({ won, rows: rows.map((r) => r.cells) })}
      <Board rows={[...rows].reverse()} />
      {rows.length > 0 && <Legend />}
    </div>
  );
}

type DailyState = { key: string; guessIds: string[] };
type Streak = { lastWin: string | null; count: number };
const NO_DAILY: DailyState = { key: "", guessIds: [] };
const NO_STREAK: Streak = { lastWin: null, count: 0 };

function Daily({ data, raw }: GameProps) {
  const today = useDailyKey();
  const [stored, setStored] = useStored<DailyState>("opm.onepiecedle.daily", NO_DAILY);
  const [streak, setStreak] = useStored<Streak>("opm.onepiecedle.streak", NO_STREAK);

  // Le personnage du jour est tiré parmi ceux que connaissent aussi les joueurs du mode anime
  const target = useMemo(() => dailyTarget(resolveGameData(raw, "anime").characters, today), [raw, today]);
  const guessIds = stored.key === today ? stored.guessIds : NO_DAILY.guessIds;
  const number = dailyNumber(today);

  function guess(character: PlayCharacter) {
    const next = [...guessIds, character.id];
    setStored({ key: today, guessIds: next });
    if (character.id === target.id && streak.lastWin !== today) {
      const follows = streak.lastWin !== null && isNextDay(streak.lastWin, today);
      setStreak({ lastWin: today, count: follows ? streak.count + 1 : 1 });
    }
  }

  return (
    <Play
      data={data}
      target={data.characterById.get(target.id) ?? target}
      guessIds={guessIds}
      onGuess={guess}
      footer={({ won, rows }) =>
        won ? (
          <ResultPanel
            title={`${target.name} !`}
            actions={
              <ShareButton
                getText={() =>
                  `OnePiecedle n°${number} · ${rows.length} essai${rows.length > 1 ? "s" : ""}\n${shareGrid(rows)}\n${window.location.origin}/jeux/onepiecedle`
                }
              />
            }
          >
            <p>
              Trouvé en {rows.length} essai{rows.length > 1 ? "s" : ""}. Prochain personnage à minuit.
            </p>
            {streak.count > 1 && <p className="font-semibold">{streak.count} jours d&apos;affilée.</p>}
          </ResultPanel>
        ) : (
          <p className="text-mist">
            Défi n°{number} : le même personnage pour tout le monde aujourd&apos;hui.
            {rows.length > 0 && ` ${rows.length} essai${rows.length > 1 ? "s" : ""}.`}
          </p>
        )
      }
    />
  );
}

type FreeRun = { seed: number; difficulty: Difficulty; guessIds: string[]; gaveUp: boolean };

function Free({ data }: GameProps) {
  const [run, setRun] = useState<FreeRun | null>(null);
  const seed = run?.seed;
  const difficulty = run?.difficulty;
  const target = useMemo(
    () =>
      seed === undefined || difficulty === undefined
        ? null
        : pick(createRng(seed), eligible(byDifficulty(data.characters, difficulty))),
    [data.characters, seed, difficulty],
  );

  const start = (level: Difficulty) => setRun({ seed: randomSeed(), difficulty: level, guessIds: [], gaveUp: false });

  if (!run || !target) {
    return (
      <StartScreen onStart={start}>
        <p className="text-mist">Autant de parties que tu veux, avec un personnage tiré au hasard.</p>
      </StartScreen>
    );
  }

  const replay = (
    <>
      <Button onClick={() => start(run.difficulty)}>Rejouer</Button>
      <Button variant="secondary" onClick={() => setRun(null)}>
        Changer de difficulté
      </Button>
    </>
  );

  return (
    <Play
      data={data}
      target={target}
      guessIds={run.guessIds}
      gaveUp={run.gaveUp}
      onGuess={(character) => setRun({ ...run, guessIds: [...run.guessIds, character.id] })}
      footer={({ won, rows }) =>
        won ? (
          <ResultPanel title={`${target.name} !`} actions={replay}>
            <p>
              Trouvé en {rows.length} essai{rows.length > 1 ? "s" : ""}.
            </p>
          </ResultPanel>
        ) : run.gaveUp ? (
          <ResultPanel title={`C'était ${target.name}`} actions={replay} />
        ) : (
          <p className="flex flex-wrap items-center justify-between gap-2 text-mist">
            <span>
              {rows.length} essai{rows.length > 1 ? "s" : ""}
            </span>
            <Button variant="ghost" className="px-0 py-0" onClick={() => setRun({ ...run, gaveUp: true })}>
              Abandonner
            </Button>
          </p>
        )
      }
    />
  );
}

const TABS = [
  { id: "daily", label: "Défi du jour" },
  { id: "free", label: "Partie libre" },
] as const;

export default function OnePiecedle(props: GameProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("daily");

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Mode de jeu" className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              tab === t.id ? "bg-straw text-ink" : "bg-sea-700 text-mist hover:text-foam"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Panel>{tab === "daily" ? <Daily {...props} /> : <Free {...props} />}</Panel>
    </div>
  );
}
