"use client";

import { useState } from "react";
import type { PlayCharacter, ResolvedData } from "@/games/cards";
import { formatBounty, formatHeight, formatNumber } from "@/games/engine/text";
import { Button } from "@/games/ui/primitives";
import { FRUIT_TYPE_LABELS, hakiLabel, RACE_LABELS, SEA_LABELS } from "@/lib/data/labels";
import { duplicatesValue, POST_IDS, POSTS, RARITY_LABELS, spareCopies } from "@/lib/economy";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { CharacterCard } from "./CharacterCard";
import { Modal } from "./Modal";

/** Fiche d'un avis de recherche de la collection : ce qu'on sait du personnage, et ses doublons. */
export function CharacterDetails({
  character,
  data,
  onClose,
}: {
  character: PlayCharacter;
  data: ResolvedData;
  onClose: () => void;
}) {
  const { state, sell } = usePlayer();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const entry = state.collection[character.id];
  const spare = spareCopies(entry);
  const spares = spare.plain + spare.golden;
  const value = duplicatesValue(character, entry);
  const fruit = character.fruitId ? data.fruitById.get(character.fruitId) : undefined;
  const post = POST_IDS.find((id) => state.crew[id] === character.id);
  const arc = character.arc !== null ? data.arcs.get(character.arc) : undefined;
  const debut =
    data.mode === "anime" && character.episode
      ? `épisode ${formatNumber(character.episode)}`
      : character.debut > 0
        ? `chapitre ${formatNumber(character.debut)}`
        : null;

  const facts: { label: string; value: string }[] = [
    { label: "Rareté", value: RARITY_LABELS[character.tier] },
    { label: "Affiliation", value: character.affiliation ?? "Aucune connue" },
    { label: "Prime", value: formatBounty(character.bounty) },
    { label: "Fruit du démon", value: fruit ? `${fruit.name} (${FRUIT_TYPE_LABELS[fruit.type]})` : "Aucun connu" },
    { label: "Haki", value: hakiLabel(character.haki) },
    ...(character.sea ? [{ label: "Origine", value: SEA_LABELS[character.sea] }] : []),
    ...(character.races.length ? [{ label: "Race", value: character.races.map((race) => RACE_LABELS[race]).join(", ") }] : []),
    ...(character.age !== null ? [{ label: "Âge", value: `${character.age} ans` }] : []),
    ...(character.height !== null ? [{ label: "Taille", value: formatHeight(character.height) }] : []),
    ...(arc || debut ? [{ label: "Première apparition", value: [arc && `arc ${arc}`, debut].filter(Boolean).join(", ") }] : []),
    ...(post ? [{ label: "Dans ton équipage", value: POSTS[post].label }] : []),
  ];

  async function sellSpares() {
    setBusy(true);
    const result = await sell(data.mode, character.id);
    setBusy(false);
    setMessage(
      result.ok
        ? `${result.sold} doublon${result.sold > 1 ? "s" : ""} défait${result.sold > 1 ? "s" : ""} : +${formatNumber(result.berrys)} ฿.`
        : "Les doublons n'ont pas pu être défaits.",
    );
  }

  return (
    <Modal title={character.name} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
        <div className="mx-auto w-44 sm:mx-0 sm:w-auto">
          <CharacterCard character={character} golden={!!entry && entry.golden > 0} count={entry?.count} />
        </div>
        <div className="space-y-3">
          {character.altName && <p className="text-mist">{character.altName}</p>}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {facts.map((fact) => (
              <div key={fact.label} className="contents">
                <dt className="font-semibold text-mist">{fact.label}</dt>
                <dd className="font-semibold text-foam">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {entry && (
        <div className="space-y-2 rounded-xl border border-sea-600 bg-sea-900/60 p-3">
          <p className="text-sm text-mist">
            <strong className="text-foam">
              {entry.count} exemplaire{entry.count > 1 ? "s" : ""}
            </strong>
            {entry.golden > 0 && `, dont ${entry.golden} doré${entry.golden > 1 ? "s" : ""}`}.{" "}
            {spares > 0
              ? "Tu peux défaire les doublons contre des Berrys : il te restera un exemplaire, le doré si tu en as un."
              : "Pas de doublon à défaire."}
          </p>
          {spares > 0 && (
            <Button onClick={sellSpares} disabled={busy}>
              Défaire {spares} doublon{spares > 1 ? "s" : ""} : +{formatNumber(value)} ฿
            </Button>
          )}
          <p className="min-h-5 text-sm font-semibold text-emerald-300" aria-live="polite">
            {message}
          </p>
        </div>
      )}
    </Modal>
  );
}
