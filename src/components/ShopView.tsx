"use client";

import Link from "next/link";
import { useState } from "react";
import type { ResolvedData } from "@/games/cards";
import { formatNumber } from "@/games/engine/text";
import { WithGameData } from "@/games/ui/WithGameData";
import {
  BOOSTER_SIZE,
  BOOSTER_SLOTS,
  boosterCost,
  crewBonuses,
  GOLDEN_CHANCE,
  RARITY_LABELS,
  RARITY_WEIGHTS,
  tavernCost,
  type Recruit,
} from "@/lib/economy";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { CharacterCard } from "./CharacterCard";
import { PackArt, PackOpening } from "./PackOpening";

type Article = "recruit" | "booster";
const REFUSALS = {
  insufficient: "Pas assez de Berrys.",
  empty: "Aucun avis à recruter pour l'instant.",
  unavailable: "Achat indisponible pour l'instant. Réessaie dans un moment.",
};

function Shop({ data }: { data: ResolvedData }) {
  const { state, recruit, booster } = usePlayer();
  const [busy, setBusy] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  // `id` : une nouvelle ouverture repart de zéro, même pour un rachat du même article
  const [opening, setOpening] = useState<{ id: number; article: Article; recruits: Recruit[] } | null>(null);

  const discount = crewBonuses(state, data.characterById).discount;
  const prices: Record<Article, number> = { recruit: tavernCost(discount), booster: boosterCost(discount) };
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);

  async function buy(article: Article) {
    setBusy(article);
    setError(null);
    const result = article === "booster" ? await booster(data.mode) : await recruit(data.mode);
    setBusy(null);
    if (!result.ok) {
      setError(REFUSALS[result.reason]);
      setOpening(null);
      return;
    }
    setOpening((previous) => ({
      id: (previous?.id ?? 0) + 1,
      article,
      recruits: "recruits" in result ? result.recruits : [result.recruit],
    }));
  }

  const base: Record<Article, number> = { recruit: tavernCost(0), booster: boosterCost(0) };
  const offers: { article: Article; title: string; pitch: string; art: React.ReactNode; action: string }[] = [
    {
      article: "recruit",
      title: "Une recrue",
      pitch: "Un avis de recherche tiré au hasard rejoint ta collection, à coup sûr.",
      action: "Acheter une recrue",
      art: (
        <div className="w-24 -rotate-3 sm:w-[130px]">
          <CharacterCard character={null} />
        </div>
      ),
    },
    {
      article: "booster",
      title: "Un booster",
      pitch: `${BOOSTER_SIZE} avis, du plus commun au plus rare. Le dernier est toujours rare ou légendaire.`,
      action: "Acheter un booster",
      art: <PackArt className="w-24 rotate-3 sm:w-[130px]" />,
    },
  ];
  const boosters = Math.floor(state.berrys / prices.booster);
  const recruits = Math.floor(state.berrys / prices.recruit);

  return (
    <div className="space-y-5">
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-display text-[40px] leading-none tracking-wide text-straw">฿ {formatNumber(state.berrys)}</span>
        <span className="text-mist">
          {boosters > 0
            ? `De quoi ouvrir ${boosters} booster${boosters > 1 ? "s" : ""}.`
            : recruits > 0
              ? `De quoi recruter ${recruits} fois.`
              : `Encore ${formatNumber(prices.recruit - state.berrys)} ฿ pour une recrue.`}
          {discount > 0 && ` Ton musicien te fait ${Math.round(Math.min(discount, 0.5) * 100)} % de réduction.`}
        </span>
      </p>

      <ul className="grid gap-5 lg:grid-cols-2">
        {offers.map((offer) => {
          const short = state.berrys < prices[offer.article];
          const featured = offer.article === "booster";
          return (
            <li key={offer.article}>
              <section
                aria-label={offer.title}
                className={`flex h-full items-center gap-5 rounded-[20px] p-5 sm:gap-6 sm:p-6 ${
                  featured ? "border-2 border-straw bg-straw/5" : "border border-sea-700 bg-sea-800"
                }`}
              >
                <div className="shrink-0">{offer.art}</div>
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  <h2 className="font-display text-[32px] leading-none tracking-wide text-foam">{offer.title}</h2>
                  <p className="text-[15px] text-mist">{offer.pitch}</p>
                  <p className="flex items-baseline gap-2.5">
                    <span className="font-display text-3xl tracking-wide text-straw">{formatNumber(prices[offer.article])} ฿</span>
                    {prices[offer.article] < base[offer.article] && (
                      <s className="text-sm text-mist">{formatNumber(base[offer.article])} ฿</s>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => buy(offer.article)}
                    disabled={busy !== null || short}
                    className={`min-h-12 cursor-pointer rounded-xl px-4 font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      featured ? "bg-straw text-ink hover:bg-straw-dark" : "border border-straw text-straw hover:bg-straw/10"
                    }`}
                  >
                    {busy === offer.article ? "Achat…" : offer.action}
                  </button>
                  {short && <p className="text-sm text-mist">Il te manque {formatNumber(prices[offer.article] - state.berrys)} ฿.</p>}
                </div>
              </section>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="font-semibold text-vest">
          {error}
        </p>
      )}

      <section aria-labelledby="contenu" className="space-y-3.5 rounded-2xl border border-sea-700 p-5">
        <h2 id="contenu" className="text-lg font-extrabold text-foam">
          Ce que contient un booster
        </h2>
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {BOOSTER_SLOTS.map((slot, index) => {
            const total = Object.values(slot).reduce((sum, weight) => sum + weight, 0);
            const best = Math.min(...Object.keys(slot).map(Number));
            const last = index === BOOSTER_SLOTS.length - 1;
            return (
              <li
                key={index}
                className={`flex flex-col gap-1 rounded-xl bg-sea-800 p-3 text-sm ${
                  last ? "border border-straw" : best <= 2 ? "border border-violet-400/70" : "border border-transparent"
                }`}
              >
                <span className={`text-xs font-extrabold tracking-wider uppercase ${last ? "text-straw" : best <= 2 ? "text-violet-300" : "text-mist"}`}>
                  Carte {index + 1}
                </span>
                {Object.entries(slot)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([tier, weight]) => (
                    <span key={tier}>
                      {RARITY_LABELS[Number(tier)]} {Math.round((weight / total) * 100)} %
                    </span>
                  ))}
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-mist">
          Chaque avis a {Math.round(GOLDEN_CHANCE * 100)} % de chances d&apos;être doré. Chaque carte est tirée séparément : un booster peut contenir des
          doublons, qui se défont contre des Berrys dans{" "}
          <Link href="/collection" className="font-bold text-straw underline underline-offset-4">
            ta collection
          </Link>
          .
        </p>
        <details className="text-sm text-mist">
          <summary className="cursor-pointer font-bold text-foam underline underline-offset-4">Chances de tirage d&apos;une recrue à l&apos;unité</summary>
          <p className="mt-2">
            {Object.entries(RARITY_WEIGHTS)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([tier, weight]) => `${RARITY_LABELS[Number(tier)]} ${Math.round((weight / totalWeight) * 100)} %`)
              .join(" · ")}
          </p>
        </details>
      </section>

      {opening && (
        <PackOpening
          key={opening.id}
          recruits={opening.recruits}
          data={data}
          onClose={() => setOpening(null)}
          again={{
            label: `${opening.article === "booster" ? "Un autre booster" : "Une autre recrue"} : ${formatNumber(prices[opening.article])} ฿`,
            disabled: busy !== null || state.berrys < prices[opening.article],
            run: () => buy(opening.article),
          }}
        />
      )}
    </div>
  );
}

export function ShopView() {
  return <WithGameData loading="Chargement de la boutique…">{({ data }) => <Shop data={data} />}</WithGameData>;
}
