"use client";

import { useMemo, useState } from "react";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { randomSeed } from "../engine/rng";
import { formatBounty } from "../engine/text";
import { Button, ResultPanel } from "../ui/primitives";
import { StartScreen } from "../ui/StartScreen";
import { useBest } from "../ui/storage";
import type { GameProps } from "../ui/types";
import { RewardSummary } from "@/components/RewardSummary";
import { useLocale, useT } from "@/lib/i18n/client";
import { useGameReward } from "@/lib/player/useGameReward";
import { advanceChain, bountyPool, isCorrect, startChain, type Answer, type Bountied, type Chain } from "./logic";

type Run = Chain & {
  seed: number;
  difficulty: Difficulty;
  streak: number;
  /** Toutes les réponses données, pour le compte rendu de partie. */
  answers: Answer[];
  /** Réponse donnée à la manche en cours, tant que la prime dévoilée est affichée. */
  answer: Answer | null;
  lost: boolean;
  newBest: boolean;
};

function Card({ character, bounty, tone }: { character: Bountied; bounty: string; tone: "known" | "hidden" | "right" | "wrong" }) {
  const tones = {
    known: "border-sea-600",
    hidden: "border-straw",
    right: "border-emerald-400",
    wrong: "border-vest",
  };
  return (
    <div className={`flex-1 rounded-2xl border-2 bg-sea-800/70 p-5 text-center ${tones[tone]}`}>
      <p className="font-display text-3xl tracking-wide text-foam">{character.name}</p>
      <p className="min-h-6 text-sm text-mist">{character.altName ?? character.affiliation}</p>
      <p className="mt-3 font-display text-3xl tracking-wide text-straw">{bounty}</p>
    </div>
  );
}

export default function PlusOuMoins({ data }: GameProps) {
  const t = useT();
  const locale = useLocale();
  const [run, setRun] = useState<Run | null>(null);
  const [best, submitBest] = useBest(`plus-ou-moins.${run?.difficulty ?? "normal"}`);
  const reward = useGameReward();
  const difficulty = run?.difficulty;
  const pool = useMemo(
    () => (difficulty ? bountyPool(byDifficulty(data.characters, difficulty)) : []),
    [data.characters, difficulty],
  );

  function start(level: Difficulty) {
    const seed = randomSeed();
    const chain = startChain(seed, bountyPool(byDifficulty(data.characters, level)), level);
    reward.reset();
    setRun({ ...chain, seed, difficulty: level, streak: 0, answers: [], answer: null, lost: false, newBest: false });
  }

  function answer(choice: Answer) {
    if (!run || run.answer) return;
    const answers = [...run.answers, choice];
    if (!isCorrect(run.current, run.next, choice)) {
      setRun({ ...run, answers, answer: choice, lost: true, newBest: submitBest(run.streak) });
      reward.submit({ slug: "plus-ou-moins", seed: run.seed, mode: data.mode, difficulty: run.difficulty, answers });
      return;
    }
    setRun({ ...run, answers, answer: choice, streak: run.streak + 1 });
  }

  function advance() {
    if (!run) return;
    setRun({ ...run, ...advanceChain(run.seed, run.streak, pool, run, run.difficulty), answer: null });
  }

  if (!run) {
    return (
      <StartScreen onStart={start}>
        <p className="text-mist">
          {t(
            "Deux avis de recherche. La prime du second est-elle plus haute ou plus basse que celle du premier ? Une seule erreur et la série s'arrête. Plus le niveau monte, plus les deux primes sont proches.",
            "Two wanted posters. Is the bounty on the second one higher or lower than on the first? One mistake and the streak is over. The higher the level, the closer the two bounties.",
          )}
        </p>
      </StartScreen>
    );
  }

  const revealed = run.answer !== null;
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-mist" aria-live="polite">
        {t("Série en cours : ", "Current streak: ")}
        <span className="text-foam">{run.streak}</span>
        {best !== null && (
          <>
            {t(" · Record : ", " · Best: ")}
            {best}
          </>
        )}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Card character={run.current} bounty={formatBounty(run.current.bounty, locale)} tone="known" />
        <Card
          character={run.next}
          bounty={revealed ? formatBounty(run.next.bounty, locale) : "? ? ?"}
          tone={!revealed ? "hidden" : run.lost ? "wrong" : "right"}
        />
      </div>

      {!revealed && (
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => answer("higher")}>{t("▲ Plus haute", "▲ Higher")}</Button>
          <Button onClick={() => answer("lower")}>{t("▼ Plus basse", "▼ Lower")}</Button>
        </div>
      )}
      {revealed && !run.lost && (
        <div className="flex items-center justify-between gap-3" aria-live="polite">
          <p className="font-bold text-emerald-300">{t("Bien vu.", "Good call.")}</p>
          <Button autoFocus onClick={advance}>
            {t("Continuer", "Continue")}
          </Button>
        </div>
      )}
      {run.lost && (
        <ResultPanel
          title={t(`Série de ${run.streak}`, `Streak of ${run.streak}`)}
          best={best !== null ? { label: t("Record à ce niveau", "Best at this level"), value: String(best) } : null}
          newBest={run.newBest}
          actions={
            <>
              <Button onClick={() => start(run.difficulty)}>{t("Rejouer", "Play again")}</Button>
              <Button variant="secondary" onClick={() => setRun(null)}>
                {t("Changer de difficulté", "Change difficulty")}
              </Button>
            </>
          }
        >
          <p>
            {t(
              `La prime de ${run.next.name} est de ${formatBounty(run.next.bounty, locale)}, celle de ${run.current.name} de ${formatBounty(run.current.bounty, locale)}.`,
              `The bounty on ${run.next.name} is ${formatBounty(run.next.bounty, locale)}, the one on ${run.current.name} is ${formatBounty(run.current.bounty, locale)}.`,
            )}
          </p>
          <RewardSummary view={reward.view} data={data} />
        </ResultPanel>
      )}
    </div>
  );
}
