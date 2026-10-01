"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ResolvedData } from "@/games/cards";
import { formatNumber } from "@/games/engine/text";
import { Button, Panel } from "@/games/ui/primitives";
import { WithGameData } from "@/games/ui/WithGameData";
import { crewBonuses, duplicatesValue, RARITY_LABELS, spareCopies, tavernCost, type Recruit } from "@/lib/economy";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { CharacterCard } from "./CharacterCard";
import { CharacterDetails } from "./CharacterDetails";

const TIERS = [1, 2, 3, 4];

function Tavern({ data }: { data: ResolvedData }) {
  const { state, recruit } = usePlayer();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Recruit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cost = tavernCost(crewBonuses(state, data.characterById).discount);
  const character = last ? (data.characterById.get(last.characterId) ?? null) : null;

  async function buy() {
    setBusy(true);
    setError(null);
    const result = await recruit(data.mode);
    setBusy(false);
    if (result.ok) setLast(result.recruit);
    else setError(result.reason === "insufficient" ? "Pas assez de Berrys." : "Recrutement indisponible pour l'instant.");
  }

  return (
    <Panel className="flex flex-wrap items-center gap-4">
      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="font-display text-3xl tracking-wide text-straw">La taverne</h2>
        <p className="text-mist">
          Paie une tournée et un personnage rejoint ta collection, à coup sûr. Les plus célèbres sont les plus rares.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={buy} disabled={busy || state.berrys < cost}>
            Recruter pour {formatNumber(cost)} ฿
          </Button>
          <span className="text-sm text-mist">Tu as {formatNumber(state.berrys)} ฿.</span>
        </div>
        <p className="min-h-6 text-sm font-semibold text-foam" aria-live="polite">
          {error ??
            (last &&
              (last.duplicate
                ? `Nouvel avis de ${character?.name ?? "ce personnage"} : tu l'avais déjà.`
                : `${character?.name ?? "Un personnage"} rejoint ta collection !`) + (last.golden ? " Avis doré !" : ""))}
        </p>
      </div>
      {last && (
        <div className="w-32 shrink-0">
          <CharacterCard character={character} golden={last.golden} />
        </div>
      )}
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
              ? "Ta collection est vide. Réussis une partie, ou passe à la taverne, pour recruter ton premier personnage."
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
          <Tavern data={data} />
          <Duplicates data={data} />
          <Collection data={data} />
        </div>
      )}
    </WithGameData>
  );
}
