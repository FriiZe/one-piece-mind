"use client";

import { useEffect, useMemo, useState } from "react";
import type { GroupCard } from "../cards";
import { Button, Panel, ResultPanel } from "../ui/primitives";
import { useStored } from "../ui/storage";
import type { GameProps } from "../ui/types";
import { acceptedForms, matchMember, membersOf, timeLimit } from "./logic";

type Run = {
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
  const [run, setRun] = useState<Run | null>(null);
  const [input, setInput] = useState("");
  // Records par groupe et par mode : les groupes proposés ne sont pas les mêmes
  const [records, setRecords] = useStored<Records>(`opm.trouve-les-tous.${data.mode}`, NO_RECORDS);

  const group = run?.group ?? null;
  const members = useMemo(() => (group ? membersOf(group, data.characterById) : []), [group, data.characterById]);
  const forms = useMemo(() => acceptedForms(members), [members]);

  const playing = run !== null && !run.over;
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
  useEffect(() => {
    if (!group || finalScore === null || finalScore <= (records[group.id] ?? 0)) return;
    setRecords({ ...records, [group.id]: finalScore });
  }, [group, finalScore, records, setRecords]);

  function start(chosen: GroupCard) {
    setInput("");
    setRun({
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

  if (!run) {
    return (
      <Panel className="space-y-4">
        <p className="text-mist">Choisis un groupe, puis cite tous ses membres avant la fin du chrono.</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.groups.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => start(g)}
                className="w-full rounded-xl border-2 border-sea-600 bg-sea-700 p-3 text-left transition-colors hover:border-straw"
              >
                <span className="block font-bold text-foam">{g.title}</span>
                <span className="block text-sm text-mist">
                  {g.memberIds.length} personnages · {formatTime(timeLimit(g.memberIds.length))}
                  {records[g.id] !== undefined && ` · record : ${records[g.id]} / ${g.memberIds.length}`}
                </span>
              </button>
            </li>
          ))}
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
            {run.found.length} / {members.length} ·{" "}
            <span className={run.remaining <= 10 && !run.over ? "text-vest" : ""}>{formatTime(run.remaining)}</span>
          </p>
        </div>

        {!run.over && (
          <div className="flex gap-2">
            <label htmlFor="trouve-saisie" className="sr-only">
              Nom d&apos;un membre du groupe
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
              placeholder="Tape un nom…"
              className="w-full rounded-lg border-2 border-sea-600 bg-sea-900 px-4 py-3 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none"
            />
            <Button variant="secondary" onClick={() => setRun({ ...run, over: true })}>
              J&apos;abandonne
            </Button>
          </div>
        )}

        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Membres du groupe">
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
          title={run.found.length === members.length ? "Tous trouvés !" : `${run.found.length} / ${members.length}`}
          best={run.previousRecord > 0 && !beaten ? { label: "Record", value: `${run.previousRecord} / ${members.length}` } : null}
          actions={
            <>
              <Button onClick={() => start(run.group)}>Rejouer</Button>
              <Button variant="secondary" onClick={() => setRun(null)}>
                Choisir un autre groupe
              </Button>
            </>
          }
        >
          {run.found.length === members.length ? (
            <p>Il te restait {formatTime(run.remaining)}.</p>
          ) : (
            <p>Les oubliés sont en rouge ci-dessus.</p>
          )}
          {beaten && <p className="font-semibold">Nouveau record !</p>}
        </ResultPanel>
      )}
    </div>
  );
}
