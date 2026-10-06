"use client";

import { useRoundLimit } from "../ui/roomRound";
import { useMemo, useState } from "react";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Portrait } from "../ui/Portrait";
import { Button, Correction, Panel } from "../ui/primitives";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import { useT } from "@/lib/i18n/client";
import { BOSS_EVERY, generateRoute, LIVES, replay } from "./logic";

export default function RouteDeGrandLine({ data }: GameProps) {
  const t = useT();
  const base = useRun("la-route-de-grand-line");
  const [answers, setAnswers] = useState<string[]>([]);
  /** Île affichée : elle reste à l'écran, avec sa correction, jusqu'à ce que le joueur reprenne la mer. */
  const [index, setIndex] = useState(0);
  const game = {
    ...base,
    start: (difficulty: Parameters<typeof base.start>[0]) => {
      setAnswers([]);
      setIndex(0);
      base.start(difficulty);
    },
  };
  const { run, finished } = base;

  const limit = useRoundLimit();
  const stages = useMemo(() => (run ? generateRoute(run.seed, data).slice(0, limit) : []), [run, data, limit]);

  if (!run || !stages.length) {
    return (
      <GameStart game={game} withDifficulty={false}>
        <p className="text-mist">
          {t(
            `Une île par arc, de Romance Dawn jusqu'où tu en es. Une question par île, sur les personnages qui y apparaissent. Tu as ${LIVES} vies ; toutes les ${BOSS_EVERY} îles, un boss : le rater coûte deux vies, le battre en rend une.`,
            `One island per arc, from Romance Dawn up to where you are in the story. One question per island, about the characters who appear there. You have ${LIVES} lives; every ${BOSS_EVERY} islands, a boss: losing to it costs two lives, beating it gives one back.`,
          )}
        </p>
      </GameStart>
    );
  }
  if (finished) {
    return (
      <GameEnd game={game} data={data} max={stages.length} withDifficulty={false}>
        <p>
          {finished.score === stages.length
            ? t("Tu as conquis toutes les îles de la route.", "You conquered every island on the route.")
            : t(
                `Ta traversée s'arrête à l'arc ${stages[Math.min(answers.length, stages.length) - 1]?.title ?? stages[0].title}.`,
                `Your voyage ends at the ${stages[Math.min(answers.length, stages.length) - 1]?.title ?? stages[0].title} arc.`,
              )}
        </p>
      </GameEnd>
    );
  }

  const stage = stages[index];
  const { question } = stage;
  const given = answers.length > index ? answers[index] : null;
  const before = replay(stages, answers.slice(0, index));
  const after = replay(stages, answers);
  const state = given === null ? before : after;
  const right = given === question.answerId;

  function answer(optionId: string) {
    if (given !== null) return;
    setAnswers([...answers, optionId]);
  }

  function next() {
    if (!run) return;
    if (after.over) {
      game.finish(after.conquered);
      game.reward.submit({ slug: "la-route-de-grand-line", seed: run.seed, mode: data.mode, answers });
      return;
    }
    setIndex(index + 1);
  }

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-mist">
        <span>
          {t(
            `Île ${index + 1} / ${stages.length} · ${state.conquered} conquise${state.conquered > 1 ? "s" : ""}`,
            `Island ${index + 1} / ${stages.length} · ${state.conquered} conquered`,
          )}
        </span>
        <span aria-label={t(`${state.lives} vies sur ${LIVES}`, `${state.lives} of ${LIVES} lives`)}>
          {Array.from({ length: LIVES }, (_, i) => (
            <span key={i} aria-hidden="true" className={`text-lg ${i < state.lives ? "text-vest" : "text-sea-600"}`}>
              ♥
            </span>
          ))}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sea-700" aria-hidden="true">
        <div className="h-full bg-straw transition-[width]" style={{ width: `${((index + (given === null ? 0 : 1)) / stages.length) * 100}%` }} />
      </div>

      <div className="space-y-2 text-center">
        <p className={`text-sm font-bold tracking-[0.2em] uppercase ${stage.boss ? "text-vest" : "text-mist"}`}>
          {stage.boss ? "Boss · " : ""}
          {t(`Arc ${stage.title}`, `${stage.title} arc`)}
        </p>
        <p className="text-mist">{question.title}</p>
        {question.img && <Portrait img={question.img} />}
        <p className={question.subject.length > 60 ? "text-xl font-bold text-foam" : "font-display text-3xl tracking-wide text-straw"}>
          {question.subject}
        </p>
        {question.detail && <p className="text-mist">{question.detail}</p>}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {question.options.map((option) => {
          const isAnswer = option.id === question.answerId;
          const tone =
            given === null
              ? "border-sea-600 bg-sea-700 hover:border-straw"
              : isAnswer
                ? "border-emerald-400 bg-emerald-600/30"
                : option.id === given
                  ? "border-vest bg-vest/30"
                  : "border-sea-700 bg-sea-800 opacity-60";
          return (
            <button
              key={option.id}
              type="button"
              disabled={given !== null}
              onClick={() => answer(option.id)}
              className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${tone}`}
            >
              {option.img && <Portrait img={option.img} className="h-20 w-16 shrink-0" />}
              <span className="min-w-0">
                <span className="block font-bold text-foam">
                  {given !== null && isAnswer ? "✓ " : given === option.id ? "✗ " : ""}
                  {option.label}
                </span>
                {option.detail && <span className="block text-sm text-mist">{option.detail}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {given !== null && (
        <Correction
          action={
            <Button autoFocus onClick={next}>
              {after.over ? t("Voir mon score", "See my score") : t("Reprendre la mer", "Set sail again")}
            </Button>
          }
        >
          <p className="text-mist">
            <strong className={right ? "text-emerald-300" : "text-vest"}>
              {right
                ? stage.boss
                  ? t("Boss battu : île conquise, une vie rendue.", "Boss beaten: island conquered, one life back.")
                  : t("Île conquise.", "Island conquered.")
                : stage.boss
                  ? t("Le boss te coûte deux vies.", "The boss costs you two lives.")
                  : t("Une vie perdue.", "One life lost.")}
            </strong>{" "}
            {question.explanation}
          </p>
        </Correction>
      )}
    </Panel>
  );
}
