"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ResolvedData } from "@/games/cards";
import { formatNumber } from "@/games/engine/text";
import { Button, Panel } from "@/games/ui/primitives";
import { WithGameData } from "@/games/ui/WithGameData";
import { BOOSTER_SIZE, duplicatesValue, RARITY_LABELS, spareCopies } from "@/lib/economy";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { CharacterCard } from "./CharacterCard";
import { CharacterDetails } from "./CharacterDetails";

const TIERS = [1, 2, 3, 4];

/** La boutique est l'autre façon d'agrandir sa collection : on y renvoie depuis ici. */
function ShopLink() {
  const { state } = usePlayer();
  return (
    <Panel className="flex flex-wrap items-center justify-between gap-3">
      <p className="min-w-0 flex-1 text-mist">
        <strong className="text-foam">La boutique</strong> vend des recrues à l&apos;unité et des boosters de {BOOSTER_SIZE} avis à
        ouvrir. Tu as {formatNumber(state.berrys)} ฿.
      </p>
      <Link href="/boutique" className="rounded-lg bg-straw px-4 py-2.5 font-bold text-ink hover:bg-straw-dark">
        Aller à la boutique
      </Link>
    </Panel>
  );
}

/** Tous les doublons visibles, défaits d'un coup : la vente est définitive, d'où la confirmation. */
function Duplicates({ data }: { data: ResolvedData }) {
  const { state, sell } = usePlayer();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  let count = 0;
  let value = 0;
  for (const character of data.characters) {
    const entry = state.collection[character.id];
    const spare = spareCopies(entry);
    count += spare.plain + spare.golden;
    value += duplicatesValue(character, entry);
  }

  async function sellAll() {
    setBusy(true);
    const result = await sell(data.mode, null);
    setBusy(false);
    setConfirming(false);
    setMessage(
      result.ok
        ? `${result.sold} doublon${result.sold > 1 ? "s" : ""} défait${result.sold > 1 ? "s" : ""} : +${formatNumber(result.berrys)} ฿.`
        : "Les doublons n'ont pas pu être défaits.",
    );
  }

  if (count === 0 && !message) return null;
  return (
    <Panel className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-mist" aria-live="polite">
        {count > 0 ? (
          <>
            <strong className="text-foam">
              {count} doublon{count > 1 ? "s" : ""}
            </strong>{" "}
            dans ta collection. Défaits, ils te rendent des Berrys ; tu gardes un exemplaire de chaque avis.
          </>
        ) : (
          <strong className="text-emerald-300">{message}</strong>
        )}
      </p>
      {count > 0 &&
        (confirming ? (
          <span className="flex flex-wrap gap-2">
            <Button onClick={sellAll} disabled={busy}>
              Confirmer : +{formatNumber(value)} ฿
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Annuler
            </Button>
          </span>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Défaire tous les doublons
          </Button>
        ))}
    </Panel>
  );
}

function Collection({ data }: { data: ResolvedData }) {
  const { state } = usePlayer();
  const [tier, setTier] = useState<number | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? data.characterById.get(openId) : undefined;

  const owned = useMemo(
    () =>
      data.characters
        .filter((c) => state.collection[c.id])
        .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name, "fr")),
    [data.characters, state.collection],
  );
  const shown = tier === null ? owned : owned.filter((c) => c.tier === tier);

  return (
    <section aria-labelledby="avis" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="avis" className="font-display text-3xl tracking-wide text-straw">
          Mes avis de recherche{" "}
          <span className="font-sans text-base font-semibold text-mist">
            · {owned.length} sur {data.characters.length}
          </span>
        </h2>
        <Link href="/profil" className="text-sm font-semibold text-mist underline underline-offset-4 hover:text-foam">
          Composer mon équipage
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par rareté">
        {[null, ...TIERS].map((value) => {
          const total = value === null ? data.characters.length : data.characters.filter((c) => c.tier === value).length;
          const have = value === null ? owned.length : owned.filter((c) => c.tier === value).length;
          return (
            <button
              key={value ?? "tous"}
              type="button"
              aria-pressed={tier === value}
              onClick={() => setTier(value)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${
                tier === value ? "bg-straw text-ink" : "bg-sea-700 text-mist hover:text-foam"
              }`}
            >
              {value === null ? "Tous" : RARITY_LABELS[value]} · {have}/{total}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <Panel>
          <p className="text-mist">
            {owned.length === 0
              ? "Ta collection est vide. Réussis une partie, ou passe à la boutique, pour recruter ton premier personnage."
              : "Aucun avis de cette rareté pour l'instant."}
          </p>
          {owned.length === 0 && (
            <Link href="/jeux" className="mt-3 inline-block font-bold text-straw underline underline-offset-4">
              Choisir un jeu
            </Link>
          )}
        </Panel>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((character) => {
            const entry = state.collection[character.id];
            return (
              <li key={character.id} className="relative transition-transform hover:-translate-y-0.5">
                <CharacterCard
                  character={character}
                  golden={entry.golden > 0}
                  count={entry.count}
                  note={character.affiliation ?? undefined}
                />
                <button
                  type="button"
                  onClick={() => setOpenId(character.id)}
                  aria-label={`Détails de l'avis de ${character.name}`}
                  className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-straw"
                />
              </li>
            );
          })}
        </ul>
      )}
      {open && state.collection[open.id] && <CharacterDetails character={open} data={data} onClose={() => setOpenId(null)} />}
    </section>
  );
}

export function CollectionView() {
  return (
    <WithGameData loading="Chargement de la collection…">
      {({ data }) => (
        <div className="space-y-8">
          <ShopLink />
          <Duplicates data={data} />
          <Collection data={data} />
        </div>
      )}
    </WithGameData>
  );
}
