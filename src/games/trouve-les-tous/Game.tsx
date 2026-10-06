"use client";

import { AutoStart, useNewSeed, useRoomRound } from "../ui/roomRound";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GroupCard } from "../cards";
import { Button, Panel, ResultPanel } from "../ui/primitives";
import { useStored } from "../ui/storage";
import type { GameProps } from "../ui/types";
import { RewardSummary } from "@/components/RewardSummary";
import { useT } from "@/lib/i18n/client";
import { useGameReward } from "@/lib/player/useGameReward";
import { acceptedForms, matchMember, membersOf, roomGroup, timeLimit } from "./logic";

type Run = {
  /** Identifie la partie : une même partie n'est récompensée qu'une fois. */
  seed: number;
  group: GroupCard;
  found: string[];
  remaining: number;
  over: boolean;
  /** Record du groupe au lancement de la partie, pour annoncer s'il est battu. */
  previousRecord: number;
};

type Records = Record<string, number>;
const NO_RECORDS: Records = {};

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function TrouveLesTous({ data }: GameProps) {
  const t = useT();
  const [run, setRun] = useState<Run | null>(null);
  const [input, setInput] = useState("");
  // Records par groupe et par mode : les groupes proposés ne sont pas les mêmes
  const [records, setRecords] = useStored<Records>(`opm.trouve-les-tous.${data.mode}`, NO_RECORDS);

  const group = run?.group ?? null;
  const members = useMemo(() => (group ? membersOf(group, data.characterById) : []), [group, data.characterById]);
  const forms = useMemo(() => acceptedForms(members), [members]);

  // En salon, pas de chrono : la manche s'arrête quand le joueur a tout trouvé ou abandonne
  const round = useRoomRound();
  const playing = run !== null && !run.over && !round;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setRun((current) => {
        if (!current || current.over) return current;
        const remaining = current.remaining - 1;
        return remaining > 0 ? { ...current, remaining } : { ...current, remaining: 0, over: true };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing]);

  // La partie peut se terminer toute seule, au bout du chrono : le record est
  // donc enregistré ici plutôt que dans un gestionnaire d'événement.
  const finalScore = run?.over ? run.found.length : null;
  // Une manche de salon ne compte pas pour les records
  useEffect(() => {
    if (round || !group || finalScore === null || finalScore <= (records[group.id] ?? 0)) return;
    setRecords({ ...records, [group.id]: finalScore });
  }, [round, group, finalScore, records, setRecords]);

  // Compte rendu de partie, envoyé une seule fois quand elle se termine (chrono compris)
  const reward = useGameReward();
  const newSeed = useNewSeed();
  const reported = useRef<number | null>(null);
  const finishedRun = run?.over ? run : null;
  const { submit } = reward;
  useEffect(() => {
    if (!finishedRun || reported.current === finishedRun.seed) return;
    reported.current = finishedRun.seed;
    submit({
      slug: "trouve-les-tous",
      seed: finishedRun.seed,
      mode: data.mode,
      groupId: finishedRun.group.id,
      found: finishedRun.found,
    });
  }, [finishedRun, data.mode, submit]);

  function start(chosen: GroupCard) {
    setInput("");
    reward.reset();
    setRun({
      seed: newSeed(),
      group: chosen,
      found: [],
      remaining: timeLimit(chosen.memberIds.length),
      over: false,
      previousRecord: records[chosen.id] ?? 0,
    });
  }

  function type(value: string) {
    if (!run || run.over) return;
    const id = matchMember(value, forms, new Set(run.found));
    if (!id) {
      setInput(value);
      return;
    }
    setInput("");
    const found = [...run.found, id];
    setRun({ ...run, found, over: found.length === members.length });
  }

  if (!run && round) {
    const group = roomGroup(round.seed, data.groups);
    if (group) return <AutoStart onStart={() => start(group)} />;
  }
  if (!run) {
    return (
      <Panel className="space-y-4">
        <p className="text-mist">
          {t(
            "Choisis un groupe, puis cite tous ses membres avant la fin du chrono.",
            "Pick a group, then name all of its members before time runs out.",
          )}
          {data.groups.some((g) => (records[g.id] ?? 0) >= g.memberIds.length) &&
            t(
              ` Groupes complétés : ${data.groups.filter((g) => (records[g.id] ?? 0) >= g.memberIds.length).length} sur ${data.groups.length}.`,
              ` Groups completed: ${data.groups.filter((g) => (records[g.id] ?? 0) >= g.memberIds.length).length} of ${data.groups.length}.`,
            )}
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.groups.map((g) => {
            // Groupe déjà cité en entier : il ressort dans la liste
            const complete = (records[g.id] ?? 0) >= g.memberIds.length;
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => start(g)}
                  className={`w-full rounded-xl border-2 p-3 text-left transition-colors hover:border-straw ${
                    complete ? "border-emerald-400 bg-emerald-600/20" : "border-sea-600 bg-sea-700"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-foam">{g.title}</span>
                    {complete && <span className="shrink-0 text-sm font-bold text-emerald-300">{t("✓ Tous trouvés", "✓ All found")}</span>}
                  </span>
                  <span className="block text-sm text-mist">
                    {t(`${g.memberIds.length} personnages`, `${g.memberIds.length} characters`)} · {formatTime(timeLimit(g.memberIds.length))}
                    {!complete &&
                      records[g.id] !== undefined &&
                      t(` · record : ${records[g.id]} / ${g.memberIds.length}`, ` · best: ${records[g.id]} / ${g.memberIds.length}`)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
    );
  }

  const found = new Set(run.found);
  const beaten = run.over && run.found.length > run.previousRecord;

  return (
    <div className="space-y-4">
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-2xl tracking-wide text-straw">{run.group.title}</h3>
          <p className="font-semibold text-foam" aria-live="off">
            {run.found.length} / {members.length}
            {!round && (
              <>
                {" · "}
                <span className={run.remaining <= 10 && !run.over ? "text-vest" : ""}>{formatTime(run.remaining)}</span>
              </>
            )}
          </p>
        </div>

        {!run.over && (
          <div className="flex gap-2">
            <label htmlFor="trouve-saisie" className="sr-only">
              {t("Nom d'un membre du groupe", "Name of a group member")}
            </label>
            <input
              id="trouve-saisie"
              type="text"
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={input}
              onChange={(event) => type(event.target.value)}
              onKeyDown={(event) => {
                // Entrée ou Échap effacent une saisie qui ne correspond à personne
                if (event.key === "Enter" || event.key === "Escape") setInput("");
              }}
              placeholder={t("Tape un nom…", "Type a name…")}
              className="w-full rounded-lg border-2 border-sea-600 bg-sea-900 px-4 py-3 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none"
            />
            <Button variant="secondary" onClick={() => setRun({ ...run, over: true })}>
              {t("J'abandonne", "I give up")}
            </Button>
          </div>
        )}

        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={t("Membres du groupe", "Group members")}>
          {members.map((member) => {
            const isFound = found.has(member.id);
            return (
              <li
                key={member.id}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  isFound
                    ? "border-emerald-400 bg-emerald-600/20 text-foam"
                    : run.over
                      ? "border-vest bg-vest/20 text-foam"
                      : "border-sea-600 bg-sea-700 text-mist"
                }`}
              >
                {isFound || run.over ? member.name : "?"}
              </li>
            );
          })}
        </ul>
      </Panel>

      {run.over && (
        <ResultPanel
          title={run.found.length === members.length ? t("Tous trouvés !", "All found!") : `${run.found.length} / ${members.length}`}
          best={run.previousRecord > 0 && !beaten ? { label: t("Record", "Best"), value: `${run.previousRecord} / ${members.length}` } : null}
          actions={
            <>
              <Button onClick={() => start(run.group)}>{t("Rejouer", "Play again")}</Button>
              <Button variant="secondary" onClick={() => setRun(null)}>
                {t("Choisir un autre groupe", "Pick another group")}
              </Button>
            </>
          }
        >
          {round ? null : run.found.length === members.length ? (
            <p>{t(`Il te restait ${formatTime(run.remaining)}.`, `You had ${formatTime(run.remaining)} left.`)}</p>
          ) : (
            <p>{t("Les oubliés sont en rouge ci-dessus.", "The ones you missed are in red above.")}</p>
          )}
          {beaten && !round && <p className="font-semibold">{t("Nouveau record !", "New best!")}</p>}
          <RewardSummary view={reward.view} data={data} />
        </ResultPanel>
      )}
    </div>
  );
}
