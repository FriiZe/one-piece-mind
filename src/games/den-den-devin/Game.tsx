"use client";

import { useMemo, useState } from "react";
import type { PlayCharacter } from "../cards";
import { criteriaFor } from "../engine/criteria";
import { CharacterSearch } from "../ui/CharacterSearch";
import { Portrait } from "../ui/Portrait";
import { Button, Panel, ResultPanel } from "../ui/primitives";
import type { GameProps } from "../ui/types";
import type { Localized } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { disagreements, MAX_GUESSES, MAX_QUESTIONS, think, type Reply, type Step } from "./logic";

const REPLIES: { reply: Reply; label: Localized }[] = [
  { reply: "yes", label: { fr: "Oui", en: "Yes" } },
  { reply: "no", label: { fr: "Non", en: "No" } },
  { reply: "unknown", label: { fr: "Je ne sais pas", en: "I don't know" } },
];
const REPLY_LABELS: Record<Reply, Localized> = {
  yes: { fr: "Oui", en: "Yes" },
  no: { fr: "Non", en: "No" },
  unknown: { fr: "Je ne sais pas", en: "I don't know" },
};

type Outcome = { won: true; character: PlayCharacter } | { won: false; character: PlayCharacter | null };

export default function DenDenDevin({ data }: GameProps) {
  const t = useT();
  const locale = useLocale();
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
          {t(
            `Pense à un personnage de One Piece, sans le dire. L'escargophone te pose jusqu'à ${MAX_QUESTIONS} questions, puis propose un nom. Réponds de ton mieux : « Je ne sais pas » est une réponse permise.`,
            `Think of a One Piece character, and keep it to yourself. The Transponder Snail asks you up to ${MAX_QUESTIONS} questions, then names someone. Answer as best you can: “I don't know” is a valid answer.`,
          )}
        </p>
        <p className="text-sm text-mist">
          {t(
            "Ce jeu ne rapporte pas de Berrys : c'est toi qui dis si l'escargophone a trouvé.",
            "This game doesn't earn Berries: you're the one who says whether the Transponder Snail got it right.",
          )}
        </p>
        <Button onClick={start}>{t("J'ai mon personnage", "I've got my character")}</Button>
      </Panel>
    );
  }

  if (outcome) {
    const wrong = !outcome.won && outcome.character ? disagreements(outcome.character, criteria, steps) : [];
    return (
      <ResultPanel
        title={
          outcome.won
            ? t(`C'était ${outcome.character.name} !`, `It was ${outcome.character.name}!`)
            : t("Tu m'as eu !", "You got me!")
        }
        actions={<Button onClick={start}>{t("Rejouer", "Play again")}</Button>}
      >
        {outcome.character?.img && <Portrait img={outcome.character.img} className="h-32 w-24" />}
        {outcome.won ? (
          <p>
            {t(
              `Trouvé en ${steps.length} question${steps.length > 1 ? "s" : ""}`,
              `Got it in ${steps.length} question${steps.length === 1 ? "" : "s"}`,
            )}
            {rejected.length > 0 && t(` et ${rejected.length + 1} propositions`, ` and ${rejected.length + 1} guesses`)}.
          </p>
        ) : outcome.character ? (
          <>
            <p>{t(`Tu pensais à ${outcome.character.name}.`, `You were thinking of ${outcome.character.name}.`)}</p>
            {wrong.length > 0 ? (
              <div>
                <p className="font-semibold">
                  {t("Voilà où nos fiches ne sont pas d'accord :", "Here's where our notes don't match:")}
                </p>
                <ul className="list-inside list-disc text-sm">
                  {wrong.map((item) => (
                    <li key={item.question}>
                      {item.question}{" "}
                      {t(
                        `Tu as répondu « ${REPLY_LABELS[item.reply].fr} ».`,
                        `You answered “${REPLY_LABELS[item.reply].en}”.`,
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm">
                {t(
                  "Tes réponses collaient à sa fiche : je manquais de questions pour le distinguer des autres.",
                  "Your answers matched their file: I just didn't have enough questions to tell them apart from the others.",
                )}
              </p>
            )}
          </>
        ) : (
          <p>
            {t(
              "Je ne connais pas tous les personnages : celui-là m'a échappé.",
              "I don't know every character: that one got away from me.",
            )}
          </p>
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
        <p className="font-display text-3xl tracking-wide text-straw">{t("Je donne ma langue au chat", "I give up")}</p>
        <p className="text-mist">{t("À qui pensais-tu ?", "Who were you thinking of?")}</p>
        <CharacterSearch
          characters={data.characters}
          onPick={(character) => setOutcome({ won: false, character })}
          label={t("Le personnage auquel tu pensais", "The character you were thinking of")}
          placeholder={t("Son nom…", "Their name…")}
        />
        <Button variant="secondary" onClick={() => setOutcome({ won: false, character: null })}>
          {t("Il n'est pas dans la liste", "They're not in the list")}
        </Button>
      </Panel>
    );
  }

  return (
    <Panel className="space-y-4">
      <div className="flex items-center justify-between text-sm font-semibold text-mist">
        <span>
          {question
            ? `Question ${steps.length + 1} / ${MAX_QUESTIONS}`
            : t(`Proposition ${rejected.length + 1} / ${MAX_GUESSES}`, `Guess ${rejected.length + 1} / ${MAX_GUESSES}`)}
        </span>
        {steps.length > 0 && (
          <button type="button" className="underline underline-offset-4 hover:text-foam" onClick={() => setSteps(steps.slice(0, -1))}>
            {t("Revenir à la question précédente", "Back to the previous question")}
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
                {label[locale]}
              </Button>
            ))}
          </div>
        </>
      ) : (
        guess && (
          <div className="space-y-3 text-center" aria-live="polite">
            <p className="text-mist">{t("Je crois que tu penses à…", "I think you're thinking of…")}</p>
            {guess.img && <Portrait img={guess.img} />}
            <p className="font-display text-4xl tracking-wide text-straw">{guess.name}</p>
            {guess.affiliation && <p className="text-mist">{guess.affiliation}</p>}
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setOutcome({ won: true, character: guess })}>
                {t("Oui, c'est ça", "Yes, that's it")}
              </Button>
              <Button variant="secondary" onClick={() => setRejected([...rejected, guess.id])}>
                {t("Non", "No")}
              </Button>
            </div>
          </div>
        )
      )}
    </Panel>
  );
}
