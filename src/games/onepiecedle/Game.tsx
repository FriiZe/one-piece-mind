"use client";

import { useNewSeed, useRoomRound } from "../ui/roomRound";
import { useMemo, useState } from "react";
import { resolveGameData, type PlayCharacter, type ResolvedData } from "../cards";
import { dailyNumber, isNextDay } from "../engine/daily";
import type { Difficulty } from "../engine/difficulty";
import { CharacterSearch } from "../ui/CharacterSearch";
import { Portrait } from "../ui/Portrait";
import { Button, Panel, ResultPanel, ShareButton } from "../ui/primitives";
import { StartScreen } from "../ui/StartScreen";
import { useDailyKey, useStored } from "../ui/storage";
import type { GameProps } from "../ui/types";
import { RewardSummary } from "@/components/RewardSummary";
import type { Localized, Translate } from "@/lib/i18n";
import { useLocale, useLocalePath, useT } from "@/lib/i18n/client";
import { useGameReward } from "@/lib/player/useGameReward";
import { COLUMNS, compare, dailyTarget, freeTarget, shareGrid, type Cell } from "./logic";

const CELL_TONES = {
  exact: "bg-emerald-600 text-white",
  partial: "bg-amber-500 text-ink",
  wrong: "bg-vest-dark text-white",
} as const;

/** « 3 essais », accordé dans chaque langue. */
const tries = (t: Translate, count: number) =>
  t(`${count} essai${count > 1 ? "s" : ""}`, `${count} ${count === 1 ? "guess" : "guesses"}`);

function Board({ rows }: { rows: { character: PlayCharacter; cells: Cell[] }[] }) {
  const t = useT();
  const locale = useLocale();
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-sea-700">
      <table className="w-full min-w-[46rem] border-separate border-spacing-1 text-center text-sm">
        <thead>
          <tr className="text-mist">
            <th scope="col" className="px-2 py-1 text-left font-semibold">
              {t("Personnage", "Character")}
            </th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className="px-2 py-1 font-semibold">
                {column.title[locale]}
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
                    <span
                      className="ml-1"
                      role="img"
                      aria-label={cell.direction === "up" ? t("plus haut", "higher") : t("plus bas", "lower")}
                    >
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
  const t = useT();
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-mist">
      <span>
        <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-emerald-600" />
        {t("Juste", "Correct")}
      </span>
      <span>
        <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-amber-500" />
        {t("En partie", "Partly")}
      </span>
      <span>
        <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-vest-dark" />
        {t("Faux", "Wrong")}
      </span>
      <span>
        {t(
          "▲ ▼ : la bonne valeur est plus haute ou plus basse (plus tard ou plus tôt pour l'arc)",
          "▲ ▼: the right value is higher or lower (later or earlier for the arc)",
        )}
      </span>
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
  const t = useT();
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
          label={t("Proposer un personnage", "Guess a character")}
          placeholder={t("Propose un personnage…", "Guess a character…")}
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
  const t = useT();
  const path = useLocalePath();
  const today = useDailyKey();
  const [stored, setStored] = useStored<DailyState>("opm.onepiecedle.daily", NO_DAILY);
  const [streak, setStreak] = useStored<Streak>("opm.onepiecedle.streak", NO_STREAK);
  const reward = useGameReward();

  // Le personnage du jour est tiré parmi ceux que connaissent aussi les joueurs du mode anime
  const target = useMemo(() => dailyTarget(resolveGameData(raw, "anime").characters, today), [raw, today]);
  const guessIds = stored.key === today ? stored.guessIds : NO_DAILY.guessIds;
  const number = dailyNumber(today);

  function guess(character: PlayCharacter) {
    const next = [...guessIds, character.id];
    setStored({ key: today, guessIds: next });
    if (character.id !== target.id) return;
    // Le défi n'est payé qu'une fois par jour : c'est le compte rendu, pas ce composant, qui le garantit
    reward.submit({ slug: "onepiecedle-daily", day: today, mode: data.mode, guesses: next });
    if (streak.lastWin !== today) {
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
            title={t(`${target.name} !`, `${target.name}!`)}
            actions={
              <ShareButton
                getText={() =>
                  `OnePiecedle ${t(`n°${number}`, `#${number}`)} · ${tries(t, rows.length)}\n${shareGrid(rows)}\n${window.location.origin}${path("/jeux/onepiecedle")}`
                }
              />
            }
          >
            {target.img && <Portrait img={target.img} className="h-32 w-24" />}
            <p>
              {t(
                `Trouvé en ${tries(t, rows.length)}. Prochain personnage à minuit.`,
                `Found in ${tries(t, rows.length)}. Next character at midnight, Paris time.`,
              )}
            </p>
            {streak.count > 1 && (
              <p className="font-semibold">{t(`${streak.count} jours d'affilée.`, `${streak.count} days in a row.`)}</p>
            )}
            <RewardSummary view={reward.view} data={data} />
          </ResultPanel>
        ) : (
          <p className="text-mist">
            {t(
              `Défi n°${number} : le même personnage pour tout le monde aujourd'hui.`,
              `Challenge #${number}: the same character for everyone today.`,
            )}
            {rows.length > 0 && ` ${tries(t, rows.length)}.`}
          </p>
        )
      }
    />
  );
}

type FreeRun = { seed: number; difficulty: Difficulty; guessIds: string[]; gaveUp: boolean };

function Free({ data }: GameProps) {
  const t = useT();
  const [run, setRun] = useState<FreeRun | null>(null);
  const reward = useGameReward();
  const newSeed = useNewSeed();
  const seed = run?.seed;
  const difficulty = run?.difficulty;
  const target = useMemo(
    () =>
      seed === undefined || difficulty === undefined ? null : freeTarget(seed, difficulty, data.characters),
    [data.characters, seed, difficulty],
  );

  function start(level: Difficulty) {
    reward.reset();
    setRun({ seed: newSeed(), difficulty: level, guessIds: [], gaveUp: false });
  }

  if (!run || !target) {
    return (
      <StartScreen onStart={start}>
        <p className="text-mist">
          {t(
            "Autant de parties que tu veux, avec un personnage tiré au hasard.",
            "As many games as you like, each with a randomly drawn character.",
          )}
        </p>
      </StartScreen>
    );
  }

  const report = (guesses: string[]) =>
    reward.submit({ slug: "onepiecedle", seed: run.seed, mode: data.mode, difficulty: run.difficulty, guesses });

  const replay = (
    <>
      <Button onClick={() => start(run.difficulty)}>{t("Rejouer", "Play again")}</Button>
      <Button variant="secondary" onClick={() => setRun(null)}>
        {t("Changer de difficulté", "Change difficulty")}
      </Button>
    </>
  );

  return (
    <Play
      data={data}
      target={target}
      guessIds={run.guessIds}
      gaveUp={run.gaveUp}
      onGuess={(character) => {
        const guessIds = [...run.guessIds, character.id];
        setRun({ ...run, guessIds });
        if (character.id === target.id) report(guessIds);
      }}
      footer={({ won, rows }) =>
        won ? (
          <ResultPanel title={t(`${target.name} !`, `${target.name}!`)} actions={replay}>
            {target.img && <Portrait img={target.img} className="h-32 w-24" />}
            <p>{t(`Trouvé en ${tries(t, rows.length)}.`, `Found in ${tries(t, rows.length)}.`)}</p>
            <RewardSummary view={reward.view} data={data} />
          </ResultPanel>
        ) : run.gaveUp ? (
          <ResultPanel title={t(`C'était ${target.name}`, `It was ${target.name}`)} actions={replay}>
            {target.img && <Portrait img={target.img} className="h-32 w-24" />}
            <RewardSummary view={reward.view} data={data} />
          </ResultPanel>
        ) : (
          <p className="flex flex-wrap items-center justify-between gap-2 text-mist">
            <span>{tries(t, rows.length)}</span>
            <Button
              variant="ghost"
              className="px-0 py-0"
              onClick={() => {
                setRun({ ...run, gaveUp: true });
                report(run.guessIds);
              }}
            >
              {t("Abandonner", "Give up")}
            </Button>
          </p>
        )
      }
    />
  );
}

const TABS = [
  { id: "daily", label: { fr: "Défi du jour", en: "Daily challenge" } },
  { id: "free", label: { fr: "Partie libre", en: "Free play" } },
] as const satisfies readonly { id: string; label: Localized }[];

export default function OnePiecedle(props: GameProps) {
  const t = useT();
  const locale = useLocale();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("daily");
  // En salon, la manche se joue en partie libre, sur la graine du salon : pas de défi du jour
  const inRoom = useRoomRound() !== null;
  if (inRoom) {
    return (
      <Panel>
        <Free {...props} />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={t("Mode de jeu", "Game mode")} className="flex gap-2">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              tab === entry.id ? "bg-straw text-ink" : "bg-sea-700 text-mist hover:text-foam"
            }`}
          >
            {entry.label[locale]}
          </button>
        ))}
      </div>
      <Panel>{tab === "daily" ? <Daily {...props} /> : <Free {...props} />}</Panel>
    </div>
  );
}
