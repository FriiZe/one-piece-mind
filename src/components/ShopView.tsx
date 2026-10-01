"use client";

import { useState } from "react";
import Link from "@/components/Link";
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
import { useLocale, useT } from "@/lib/i18n/client";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { CharacterCard } from "./CharacterCard";
import { CosmeticsShop } from "./CosmeticsShop";
import { PackArt, PackOpening } from "./PackOpening";

type Article = "recruit" | "booster";
const REFUSALS = {
  fr: {
    insufficient: "Pas assez de Berrys.",
    empty: "Aucun avis à recruter pour l'instant.",
    unavailable: "Achat indisponible pour l'instant. Réessaie dans un moment.",
  },
  en: {
    insufficient: "Not enough Berries.",
    empty: "No posters to recruit for now.",
    unavailable: "Purchases are unavailable right now. Try again in a moment.",
  },
};

function Shop({ data }: { data: ResolvedData }) {
  const { state, recruit, booster } = usePlayer();
  const t = useT();
  const locale = useLocale();
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
      setError(REFUSALS[locale][result.reason]);
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
      title: t("Une recrue", "A recruit"),
      pitch: t(
        "Un avis de recherche tiré au hasard rejoint ta collection, à coup sûr.",
        "A randomly drawn wanted poster joins your collection, guaranteed.",
      ),
      action: t("Acheter une recrue", "Buy a recruit"),
      art: (
        <div className="w-24 -rotate-3 sm:w-[130px]">
          <CharacterCard character={null} />
        </div>
      ),
    },
    {
      article: "booster",
      title: t("Un booster", "A booster"),
      pitch: t(
        `${BOOSTER_SIZE} avis, du plus commun au plus rare. Le dernier est toujours rare ou légendaire.`,
        `${BOOSTER_SIZE} posters, from the most common to the rarest. The last one is always rare or legendary.`,
      ),
      action: t("Acheter un booster", "Buy a booster"),
      art: <PackArt className="w-24 rotate-3 sm:w-[130px]" />,
    },
  ];
  const boosters = Math.floor(state.berrys / prices.booster);
  const recruits = Math.floor(state.berrys / prices.recruit);

  return (
    <div className="space-y-5">
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-display text-[40px] leading-none tracking-wide text-straw">฿ {formatNumber(state.berrys, locale)}</span>
        <span className="text-mist">
          {boosters > 0
            ? t(
                `De quoi ouvrir ${boosters} booster${boosters > 1 ? "s" : ""}.`,
                `Enough to open ${boosters} ${boosters === 1 ? "booster" : "boosters"}.`,
              )
            : recruits > 0
              ? t(
                  `De quoi recruter ${recruits} fois.`,
                  `Enough to recruit ${recruits === 1 ? "once" : `${recruits} times`}.`,
                )
              : t(
                  `Encore ${formatNumber(prices.recruit - state.berrys, locale)} ฿ pour une recrue.`,
                  `${formatNumber(prices.recruit - state.berrys, locale)} ฿ more for a recruit.`,
                )}
          {discount > 0 &&
            t(
              ` Ton musicien te fait ${Math.round(Math.min(discount, 0.5) * 100)} % de réduction.`,
              ` Your musician gets you ${Math.round(Math.min(discount, 0.5) * 100)}% off.`,
            )}
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
                    <span className="font-display text-3xl tracking-wide text-straw">{formatNumber(prices[offer.article], locale)} ฿</span>
                    {prices[offer.article] < base[offer.article] && (
                      <s className="text-sm text-mist">{formatNumber(base[offer.article], locale)} ฿</s>
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
                    {busy === offer.article ? t("Achat…", "Buying…") : offer.action}
                  </button>
                  {short && (
                    <p className="text-sm text-mist">
                      {t(
                        `Il te manque ${formatNumber(prices[offer.article] - state.berrys, locale)} ฿.`,
                        `You're ${formatNumber(prices[offer.article] - state.berrys, locale)} ฿ short.`,
                      )}
                    </p>
                  )}
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
          {t("Ce que contient un booster", "What's in a booster")}
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
                  {t("Carte", "Card")} {index + 1}
                </span>
                {Object.entries(slot)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([tier, weight]) => (
                    <span key={tier}>
                      {RARITY_LABELS[locale][Number(tier)]} {Math.round((weight / total) * 100)}
                      {t(" %", "%")}
                    </span>
                  ))}
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-mist">
          {t(
            `Chaque avis a ${Math.round(GOLDEN_CHANCE * 100)} % de chances d'être doré. Chaque carte est tirée séparément : un booster peut contenir des doublons, qui se défont contre des Berrys dans`,
            `Each poster has a ${Math.round(GOLDEN_CHANCE * 100)}% chance of being golden. Each card is drawn separately: a booster can contain duplicates, which you can scrap for Berries in`,
          )}{" "}
          <Link href="/collection" className="font-bold text-straw underline underline-offset-4">
            {t("ta collection", "your collection")}
          </Link>
          .
        </p>
        <details className="text-sm text-mist">
          <summary className="cursor-pointer font-bold text-foam underline underline-offset-4">
            {t("Chances de tirage d'une recrue à l'unité", "Drop rates for a single recruit")}
          </summary>
          <p className="mt-2">
            {Object.entries(RARITY_WEIGHTS)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([tier, weight]) => `${RARITY_LABELS[locale][Number(tier)]} ${Math.round((weight / totalWeight) * 100)}${t(" %", "%")}`)
              .join(" · ")}
          </p>
        </details>
      </section>

      <CosmeticsShop />

      {opening && (
        <PackOpening
          key={opening.id}
          recruits={opening.recruits}
          data={data}
          onClose={() => setOpening(null)}
          again={{
            label: `${
              opening.article === "booster" ? t("Un autre booster", "Another booster") : t("Une autre recrue", "Another recruit")
            }${t(" : ", ": ")}${formatNumber(prices[opening.article], locale)} ฿`,
            disabled: busy !== null || state.berrys < prices[opening.article],
            run: () => buy(opening.article),
          }}
        />
      )}
    </div>
  );
}

export function ShopView() {
  const t = useT();
  return (
    <WithGameData loading={t("Chargement de la boutique…", "Loading the shop…")}>{({ data }) => <Shop data={data} />}</WithGameData>
  );
}
