"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ResolvedData } from "@/games/cards";
import { formatNumber } from "@/games/engine/text";
import { Button, Panel } from "@/games/ui/primitives";
import { WithGameData } from "@/games/ui/WithGameData";
import { duplicatesValue, RARITY_LABELS, spareCopies } from "@/lib/economy";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { CharacterCard } from "./CharacterCard";
import { CharacterDetails } from "./CharacterDetails";

const TIERS = [1, 2, 3, 4];

/** Avis manquants affichés d'un coup : au-delà, on se contente de les compter. */
const MISSING_SHOWN = 30;

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
    <span className="flex flex-wrap items-center gap-2 sm:ml-auto" aria-live="polite">
      {count === 0 ? (
        <strong className="text-sm text-emerald-300">{message}</strong>
      ) : confirming ? (
        <>
          <span className="text-sm text-mist">Tu gardes un exemplaire de chaque avis.</span>
          <Button onClick={sellAll} disabled={busy} className="min-h-11 py-0 text-sm">
            Confirmer : +{formatNumber(value)} ฿
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy} className="min-h-11 py-0 text-sm">
            Annuler
          </Button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-11 cursor-pointer rounded-full border border-straw/50 px-4 text-sm font-bold text-straw transition-colors hover:bg-straw/10"
        >
          Défaire {count} doublon{count > 1 ? "s" : ""} · +{formatNumber(value)} ฿
        </button>
      )}
    </span>
  );
}

function Collection({ data }: { data: ResolvedData }) {
  const { state } = usePlayer();
  const [tier, setTier] = useState<number | null>(null);
  const [withMissing, setWithMissing] = useState(false);
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
  const missing = useMemo(
    () => (withMissing ? data.characters.filter((c) => !state.collection[c.id] && (tier === null || c.tier === tier)).sort((a, b) => a.tier - b.tier) : []),
    [withMissing, data.characters, state.collection, tier],
  );

  return (
    <section aria-labelledby="avis" className="space-y-5">
      <h2 id="avis" className="sr-only">
        Mes avis de recherche
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrer par rareté" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {[null, ...TIERS].map((value) => {
            const total = value === null ? data.characters.length : data.characters.filter((c) => c.tier === value).length;
            const have = value === null ? owned.length : owned.filter((c) => c.tier === value).length;
            return (
              <button
                key={value ?? "tous"}
                type="button"
                aria-pressed={tier === value}
                onClick={() => setTier(value)}
                className={`min-h-11 cursor-pointer rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors ${
                  tier === value ? "bg-straw text-ink" : "border border-sea-700 text-mist hover:text-foam"
                }`}
              >
                {value === null ? "Tous" : RARITY_LABELS[value]} · {have} / {total}
              </button>
            );
          })}
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 px-1 text-sm font-bold text-mist">
          <input type="checkbox" checked={withMissing} onChange={(event) => setWithMissing(event.target.checked)} className="size-[18px] accent-straw" />
          Montrer les manquants
        </label>
        <Duplicates data={data} />
      </div>

      {shown.length === 0 && missing.length === 0 ? (
        <Panel>
          <p className="text-mist">
            {owned.length === 0
              ? "Ta collection est vide. Valide un jeu du jour, ou passe à la boutique, pour recruter ton premier personnage."
              : "Aucun avis de cette rareté pour l'instant."}
          </p>
          {owned.length === 0 && (
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-bold">
              <Link href="/" className="text-straw underline underline-offset-4">
                Voir les jeux du jour
              </Link>
              <Link href="/boutique" className="text-straw underline underline-offset-4">
                Aller à la boutique
              </Link>
            </p>
          )}
        </Panel>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3.5 lg:grid-cols-6">
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
          {missing.slice(0, MISSING_SHOWN).map((character) => (
            <li
              key={character.id}
              className="flex aspect-[3/4.6] flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-sea-600 text-[#6f8fb0]"
            >
              <span aria-hidden="true" className="font-display text-4xl">
                ?
              </span>
              <span className="px-1 text-center text-xs font-bold">Manquant · {RARITY_LABELS[character.tier].toLowerCase()}</span>
            </li>
          ))}
        </ul>
      )}
      {missing.length > MISSING_SHOWN && (
        <p className="text-sm text-mist">
          Et {formatNumber(missing.length - MISSING_SHOWN)} autres avis à recruter{tier === null ? "" : " dans cette rareté"}.
        </p>
      )}
      {open && state.collection[open.id] && <CharacterDetails character={open} data={data} onClose={() => setOpenId(null)} />}
    </section>
  );
}

export function CollectionView() {
  return <WithGameData loading="Chargement de la collection…">{({ data }) => <Collection data={data} />}</WithGameData>;
}
