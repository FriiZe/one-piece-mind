"use client";

import { useMemo, useState } from "react";
import { formatBounty } from "../engine/text";
import { GameEnd, GameStart } from "../ui/GameEnd";
import { Portrait } from "../ui/Portrait";
import { Button, Panel, Progress } from "../ui/primitives";
import type { GameProps } from "../ui/types";
import { useRun } from "../ui/useRun";
import { useLocale, useT } from "@/lib/i18n/client";
import { generateDraw, MAX_SCORE, pointsFor, POSTS, ranksOf, scorePlacement } from "./logic";

/** Rang en anglais : 1st, 2nd, 3rd, 4th… (dix postes au plus). */
const ordinal = (rank: number) => `${rank}${["th", "st", "nd", "rd"][rank] ?? "th"}`;

export default function RecruteTonEquipage({ data }: GameProps) {
  const t = useT();
  const locale = useLocale();
  const base = useRun("recrute-ton-equipage");
  /** Poste donné à chaque personnage déjà placé, dans l'ordre du tirage. */
  const [posts, setPosts] = useState<number[]>([]);
  /** Poste survolé pendant qu'on y fait glisser la recrue. */
  const [over, setOver] = useState<number | null>(null);
  const game = {
    ...base,
    start: (difficulty: Parameters<typeof base.start>[0]) => {
      setPosts([]);
      base.start(difficulty);
    },
  };
  const { run, finished } = base;

  const draw = useMemo(() => (run ? generateDraw(run.seed, run.difficulty, data) : []), [run, data]);

  if (!run || !draw.length) {
    return (
      <GameStart game={game}>
        <p className="text-mist">
          {t(
            "Dix personnages se présentent un à un. Donne à chacun un poste, du capitaine au mousse, sans connaître les suivants : l'équipage idéal range les primes de la plus haute à la plus basse.",
            "Ten characters show up one at a time. Give each one a post, from captain to cabin boy, without knowing who comes next: the ideal crew lines up the bounties from highest to lowest.",
          )}
        </p>
      </GameStart>
    );
  }
  if (finished) return <GameEnd game={game} data={data} max={MAX_SCORE} />;

  const done = posts.length === draw.length;
  const current = done ? null : draw[posts.length];
  const ranks = ranksOf(draw);
  const score = done ? scorePlacement(draw, posts) : 0;

  function finish() {
    if (!run) return;
    game.finish(score);
    game.reward.submit({ slug: "recrute-ton-equipage", seed: run.seed, mode: data.mode, difficulty: run.difficulty, posts });
  }

  return (
    <Panel className="space-y-4">
      <Progress current={Math.min(posts.length + 1, draw.length)} total={draw.length} score={done ? t(`Score : ${score} / ${MAX_SCORE}`, `Score: ${score} / ${MAX_SCORE}`) : undefined} />

      {current && (
        <div className="space-y-2 text-center" aria-live="polite">
          <p className="text-mist">
            {t(
              "Quel poste pour cette recrue ? Clique sur un poste, ou fais-y glisser la recrue.",
              "Which post for this recruit? Click a post, or drag the recruit onto it.",
            )}
          </p>
          {/* La recrue se dépose sur un poste libre ; le clic sur le poste reste possible, au doigt comme au clavier */}
          <div
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", current.id);
              event.dataTransfer.effectAllowed = "move";
            }}
            className="mx-auto w-fit cursor-grab space-y-2 rounded-xl border-2 border-dashed border-sea-600 px-6 py-3 active:cursor-grabbing"
          >
            {current.img && <Portrait img={current.img} />}
            <p className="font-display text-3xl tracking-wide text-straw">{current.name}</p>
            {current.affiliation && <p className="text-mist">{current.affiliation}</p>}
          </div>
        </div>
      )}

      <ol className="grid gap-2 sm:grid-cols-2">
        {POSTS.map((name, post) => {
          const label = name[locale];
          const index = posts.indexOf(post);
          const member = index >= 0 ? draw[index] : null;
          const points = member ? pointsFor(ranks[index], post) : 0;
          return (
            <li key={label}>
              <button
                type="button"
                disabled={!!member || done}
                onClick={() => setPosts([...posts, post])}
                onDragOver={(event) => {
                  if (member || done) return;
                  event.preventDefault();
                  setOver(post);
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  setOver(null);
                  if (!member && !done) setPosts([...posts, post]);
                }}
                aria-label={
                  member
                    ? t(`${label} : ${member.name}`, `${label}: ${member.name}`)
                    : t(`Placer au poste de ${label}`, `Assign to the ${label} post`)
                }
                className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 px-3 py-2 text-left transition-colors disabled:cursor-default ${
                  member
                    ? done
                      ? points === 5
                        ? "border-emerald-400 bg-emerald-600/25"
                        : points > 0
                          ? "border-straw/70 bg-straw/10"
                          : "border-vest bg-vest/20"
                      : "border-sea-700 bg-sea-800"
                    : over === post
                      ? "border-straw bg-straw/20"
                      : "border-sea-600 bg-sea-700 hover:border-straw"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold tracking-wide text-mist uppercase">
                    {post + 1}. {label}
                  </span>
                  <span className="block truncate font-bold text-foam">{member ? member.name : t("Poste libre", "Open post")}</span>
                  {/* Les primes ne sont dévoilées qu'une fois l'équipage au complet */}
                  {member && done && (
                    <span className="block text-sm text-mist">
                      {formatBounty(member.bounty, locale)} ·{" "}
                      {t(
                        `${ranks[index] + 1}${ranks[index] === 0 ? "re" : "e"} prime`,
                        ranks[index] === 0 ? "highest bounty" : `${ordinal(ranks[index] + 1)} highest bounty`,
                      )}
                    </span>
                  )}
                </span>
                {member && done && <span className="shrink-0 font-display text-xl tracking-wide text-straw">+{points}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {done && (
        <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
          <p className="text-mist">
            {t(
              "Cinq points pour une prime au bon poste, un de moins par poste d'écart.",
              "Five points for a bounty at the right post, one fewer for each post it is off by.",
            )}
          </p>
          <Button autoFocus onClick={finish}>
            {t("Voir mon score", "See my score")}
          </Button>
        </div>
      )}
    </Panel>
  );
}
