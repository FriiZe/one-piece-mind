"use client";

import { useMemo, useState } from "react";
import type { PlayCharacter } from "../cards";
import { criteriaFor } from "../engine/criteria";
import { CharacterSearch } from "../ui/CharacterSearch";
import { Portrait } from "../ui/Portrait";
import { Button, Panel, ResultPanel } from "../ui/primitives";
import type { GameProps } from "../ui/types";
import { disagreements, MAX_GUESSES, MAX_QUESTIONS, think, type Reply, type Step } from "./logic";

const REPLIES: { reply: Reply; label: string }[] = [
  { reply: "yes", label: "Oui" },
  { reply: "no", label: "Non" },
  { reply: "unknown", label: "Je ne sais pas" },
];
const REPLY_LABELS: Record<Reply, string> = { yes: "Oui", no: "Non", unknown: "Je ne sais pas" };

type Outcome = { won: true; character: PlayCharacter } | { won: false; character: PlayCharacter | null };

export default function DenDenDevin({ data }: GameProps) {
  const [playing, setPlaying] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  /** Personnages déjà proposés, et refusés par le joueur. */
  const [rejected, setRejected] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const criteria = useMemo(() => criteriaFor(data), [data]);
  const thinking = useMemo(() => think(data.characters, criteria, steps, new Set(rejected)), [data.characters, criteria, steps, rejected]);

  function start() {
    setSteps([]);
    setRejected([]);
    setOutcome(null);
    setPlaying(true);
  }

  if (!playing) {
    return (
      <Panel className="space-y-4">
        <p className="text-mist">
          Pense à un personnage de One Piece, sans le dire. L&apos;escargophone te pose jusqu&apos;à {MAX_QUESTIONS} questions,
          puis propose un nom. Réponds de ton mieux : « Je ne sais pas » est une réponse permise.
        </p>
        <p className="text-sm text-mist">Ce jeu ne rapporte pas de Berrys : c&apos;est toi qui dis si l&apos;escargophone a trouvé.</p>
        <Button onClick={start}>J&apos;ai mon personnage</Button>
      </Panel>
    );
  }

  if (outcome) {
    const wrong = !outcome.won && outcome.character ? disagreements(outcome.character, criteria, steps) : [];
    return (
      <ResultPanel
        title={outcome.won ? `C'était ${outcome.character.name} !` : "Tu m'as eu !"}
        actions={<Button onClick={start}>Rejouer</Button>}
      >
        {outcome.character?.img && <Portrait img={outcome.character.img} className="h-32 w-24" />}
        {outcome.won ? (
          <p>
            Trouvé en {steps.length} question{steps.length > 1 ? "s" : ""}
            {rejected.length > 0 && ` et ${rejected.length + 1} propositions`}.
          </p>
        ) : outcome.character ? (
          <>
            <p>Tu pensais à {outcome.character.name}.</p>
            {wrong.length > 0 ? (
              <div>
                <p className="font-semibold">Voilà où nos fiches ne sont pas d&apos;accord :</p>
                <ul className="list-inside list-disc text-sm">
                  {wrong.map((item) => (
                    <li key={item.question}>
                      {item.question} Tu as répondu « {REPLY_LABELS[item.reply]} ».
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm">Tes réponses collaient à sa fiche : je manquais de questions pour le distinguer des autres.</p>
            )}
          </>
        ) : (
          <p>Je ne connais pas tous les personnages : celui-là m&apos;a échappé.</p>
        )}
      </ResultPanel>
    );
  }

  const { question, best } = thinking;
  const guess = question ? null : (best[0] ?? null);
  // Plus de candidat, ou trop de propositions refusées : l'escargophone s'avoue vaincu
  const beaten = !question && (guess === null || rejected.length >= MAX_GUESSES);

  if (beaten) {
    return (
      <Panel className="space-y-4">
        <p className="font-display text-3xl tracking-wide text-straw">Je donne ma langue au chat</p>
        <p className="text-mist">À qui pensais-tu ?</p>
        <CharacterSearch
          characters={data.characters}
          onPick={(character) => setOutcome({ won: false, character })}
          label="Le personnage auquel tu pensais"
          placeholder="Son nom…"
        />
        <Button variant="secondary" onClick={() => setOutcome({ won: false, character: null })}>
          Il n&apos;est pas dans la liste
        </Button>
      </Panel>
    );
  }

  return (
    <Panel className="space-y-4">
      <div className="flex items-center justify-between text-sm font-semibold text-mist">
        <span>{question ? `Question ${steps.length + 1} / ${MAX_QUESTIONS}` : `Proposition ${rejected.length + 1} / ${MAX_GUESSES}`}</span>
        {steps.length > 0 && (
          <button type="button" className="underline underline-offset-4 hover:text-foam" onClick={() => setSteps(steps.slice(0, -1))}>
            Revenir à la question précédente
          </button>
        )}
      </div>

      {question ? (
        <>
          <p className="text-center text-2xl font-bold text-foam" aria-live="polite">
            {question.question}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {REPLIES.map(({ reply, label }) => (
              <Button
                key={reply}
                variant={reply === "unknown" ? "secondary" : "primary"}
                onClick={() => setSteps([...steps, { criterionId: question.id, reply }])}
              >
                {label}
              </Button>
            ))}
          </div>
        </>
      ) : (
        guess && (
          <div className="space-y-3 text-center" aria-live="polite">
            <p className="text-mist">Je crois que tu penses à…</p>
            {guess.img && <Portrait img={guess.img} />}
            <p className="font-display text-4xl tracking-wide text-straw">{guess.name}</p>
            {guess.affiliation && <p className="text-mist">{guess.affiliation}</p>}
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setOutcome({ won: true, character: guess })}>Oui, c&apos;est ça</Button>
              <Button variant="secondary" onClick={() => setRejected([...rejected, guess.id])}>
                Non
              </Button>
            </div>
          </div>
        )
      )}
    </Panel>
  );
}
