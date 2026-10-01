"use client";

import { useState } from "react";
import type { PlayCharacter, ResolvedData } from "@/games/cards";
import { formatBounty, formatHeight, formatNumber } from "@/games/engine/text";
import { Button } from "@/games/ui/primitives";
import { FRUIT_TYPE_LABELS, hakiLabel, RACE_LABELS, SEA_LABELS } from "@/lib/data/labels";
import { duplicatesValue, POST_IDS, POSTS, RARITY_LABELS, spareCopies } from "@/lib/economy";
import { useLocale, useT } from "@/lib/i18n/client";
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
  const t = useT();
  const locale = useLocale();
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
      ? t(`épisode ${formatNumber(character.episode, locale)}`, `episode ${formatNumber(character.episode, locale)}`)
      : character.debut > 0
        ? t(`chapitre ${formatNumber(character.debut, locale)}`, `chapter ${formatNumber(character.debut, locale)}`)
        : null;

  const facts: { label: string; value: string }[] = [
    { label: t("Rareté", "Rarity"), value: RARITY_LABELS[locale][character.tier] },
    { label: t("Affiliation", "Affiliation"), value: character.affiliation ?? t("Aucune connue", "None known") },
    { label: t("Prime", "Bounty"), value: formatBounty(character.bounty, locale) },
    {
      label: t("Fruit du démon", "Devil Fruit"),
      value: fruit ? `${fruit.name} (${FRUIT_TYPE_LABELS[locale][fruit.type]})` : t("Aucun connu", "None known"),
    },
    { label: t("Haki", "Haki"), value: hakiLabel(character.haki, locale) },
    ...(character.sea ? [{ label: t("Origine", "Origin"), value: SEA_LABELS[locale][character.sea] }] : []),
    ...(character.races.length
      ? [{ label: t("Race", "Race"), value: character.races.map((race) => RACE_LABELS[locale][race]).join(", ") }]
      : []),
    ...(character.age !== null
      ? [{ label: t("Âge", "Age"), value: t(`${character.age} ans`, `${character.age} years old`) }]
      : []),
    ...(character.height !== null
      ? [{ label: t("Taille", "Height"), value: formatHeight(character.height, locale) }]
      : []),
    ...(arc || debut
      ? [
          {
            label: t("Première apparition", "First appearance"),
            value: [arc && t(`arc ${arc}`, `${arc} arc`), debut].filter(Boolean).join(", "),
          },
        ]
      : []),
    ...(post ? [{ label: t("Dans ton équipage", "In your crew"), value: POSTS[post].label[locale] }] : []),
  ];

  async function sellSpares() {
    setBusy(true);
    const result = await sell(data.mode, character.id);
    setBusy(false);
    setMessage(
      result.ok
        ? t(
            `${result.sold} doublon${result.sold > 1 ? "s" : ""} défait${result.sold > 1 ? "s" : ""} : +${formatNumber(result.berrys, locale)} ฿.`,
            `${result.sold} ${result.sold === 1 ? "duplicate" : "duplicates"} scrapped: +${formatNumber(result.berrys, locale)} ฿.`,
          )
        : t("Les doublons n'ont pas pu être défaits.", "The duplicates couldn't be scrapped."),
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
              {t(
                `${entry.count} exemplaire${entry.count > 1 ? "s" : ""}`,
                `${entry.count} ${entry.count === 1 ? "copy" : "copies"}`,
              )}
            </strong>
            {entry.golden > 0 &&
              t(`, dont ${entry.golden} doré${entry.golden > 1 ? "s" : ""}`, `, including ${entry.golden} golden`)}
            .{" "}
            {spares > 0
              ? t(
                  "Tu peux défaire les doublons contre des Berrys : il te restera un exemplaire, le doré si tu en as un.",
                  "You can scrap the duplicates for Berries: you'll keep one copy, the golden one if you have it.",
                )
              : t("Pas de doublon à défaire.", "No duplicates to scrap.")}
          </p>
          {spares > 0 && (
            <Button onClick={sellSpares} disabled={busy}>
              {t(
                `Défaire ${spares} doublon${spares > 1 ? "s" : ""} : +${formatNumber(value, locale)} ฿`,
                `Scrap ${spares} ${spares === 1 ? "duplicate" : "duplicates"}: +${formatNumber(value, locale)} ฿`,
              )}
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
