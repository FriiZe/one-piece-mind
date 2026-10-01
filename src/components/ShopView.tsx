"use client";

import Link from "next/link";
import { useState } from "react";
import type { ResolvedData } from "@/games/cards";
import { formatNumber } from "@/games/engine/text";
import { Button, Panel } from "@/games/ui/primitives";
import { WithGameData } from "@/games/ui/WithGameData";
import {
  BOOSTER_GUARANTEED_TIER,
  BOOSTER_SIZE,
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

  const offers: { article: Article; title: string; pitch: string; art: React.ReactNode }[] = [
    {
      article: "recruit",
      title: "Une recrue",
      pitch: "Un avis de recherche tiré au hasard rejoint ta collection, à coup sûr.",
      art: (
        <div className="w-28 -rotate-3">
          <CharacterCard character={null} />
        </div>
      ),
    },
    {
      article: "booster",
      title: "Un booster",
      pitch: `${BOOSTER_SIZE} avis d'un coup, dont au moins un ${RARITY_LABELS[BOOSTER_GUARANTEED_TIER].toLowerCase()} ou mieux. Moins cher qu'à l'unité.`,
      art: <PackArt className="w-28 rotate-3" />,
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-lg text-mist">
        Tu as <strong className="text-straw">{formatNumber(state.berrys)} ฿</strong>.
        {discount > 0 && ` Ton musicien te fait ${Math.round(Math.min(discount, 0.5) * 100)} % de réduction.`}
      </p>

      <ul className="grid gap-4 sm:grid-cols-2">
        {offers.map((offer) => (
          <li key={offer.article}>
            <Panel className="flex h-full items-center gap-4">
              <div className="shrink-0">{offer.art}</div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <h2 className="font-display text-3xl tracking-wide text-straw">{offer.title}</h2>
                <p className="text-mist">{offer.pitch}</p>
                <div>
                  <Button onClick={() => buy(offer.article)} disabled={busy !== null || state.berrys < prices[offer.article]}>
                    {busy === offer.article ? "Achat…" : `Acheter : ${formatNumber(prices[offer.article])} ฿`}
                  </Button>
                </div>
                {state.berrys < prices[offer.article] && (
                  <p className="text-sm text-mist">Il te manque {formatNumber(prices[offer.article] - state.berrys)} ฿.</p>
                )}
              </div>
            </Panel>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="font-semibold text-vest">
          {error}
        </p>
      )}

      <Panel className="space-y-3">
        <h2 className="font-display text-2xl tracking-wide text-straw">Chances de tirage</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          {Object.entries(RARITY_WEIGHTS)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([tier, weight]) => (
              <div key={tier} className="flex flex-col-reverse rounded-lg border border-sea-700 px-3 py-2">
                <dt className="text-mist">{RARITY_LABELS[Number(tier)]}</dt>
                <dd className="font-display text-2xl tracking-wide text-foam">{Math.round((weight / totalWeight) * 100)} %</dd>
              </div>
            ))}
          <div className="flex flex-col-reverse rounded-lg border border-straw/50 px-3 py-2">
            <dt className="text-mist">Avis doré</dt>
            <dd className="font-display text-2xl tracking-wide text-straw">{Math.round(GOLDEN_CHANCE * 100)} %</dd>
          </div>
        </dl>
        <p className="text-sm text-mist">
          Chaque avis est tiré séparément : un booster peut contenir des doublons.{" "}
          <Link href="/collection" className="font-semibold text-straw underline underline-offset-4">
            Dans ta collection
          </Link>
          , ils se défont contre des Berrys.
        </p>
      </Panel>

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
