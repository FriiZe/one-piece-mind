"use client";

import { useState, type ReactNode } from "react";
import { formatNumber } from "@/games/engine/text";
import {
  COSMETIC_DEFAULTS,
  COSMETIC_SLOT_LABELS,
  COSMETIC_SLOTS,
  COSMETICS,
  type Cosmetic,
  type CosmeticError,
  type CosmeticSlot,
} from "@/lib/economy";
import type { Localized } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { FlagArt, FrameArt, ShipArt } from "./Cosmetics";

const REFUSALS: Localized<Record<CosmeticError | "unavailable", string>> = {
  fr: {
    unknown: "Ce cosmétique n'existe pas.",
    owned: "Tu l'as déjà.",
    locked: "Ce cosmétique ne s'achète pas : il se gagne.",
    insufficient: "Pas assez de Berrys.",
    "not-owned": "Tu ne possèdes pas ce cosmétique.",
    unavailable: "Achat indisponible pour l'instant. Réessaie dans un moment.",
  },
  en: {
    unknown: "That cosmetic doesn't exist.",
    owned: "You already have it.",
    locked: "That cosmetic can't be bought: it has to be earned.",
    insufficient: "Not enough Berries.",
    "not-owned": "You don't own that cosmetic.",
    unavailable: "Purchases are unavailable right now. Try again in a moment.",
  },
};

/** Les cosmétiques de la boutique, par emplacement : acheter, porter, ou revenir à l'apparence d'origine. */
export function CosmeticsShop() {
  const { state, buyLook, wear } = usePlayer();
  const t = useT();
  const locale = useLocale();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { owned, equipped } = state.cosmetics;

  async function run(key: string, action: () => Promise<{ ok: true } | { ok: false; reason: CosmeticError | "unavailable" }>) {
    setBusy(key);
    setError(null);
    const result = await action();
    setBusy(null);
    if (!result.ok) setError(REFUSALS[locale][result.reason]);
  }

  /** Aperçu d'un cosmétique. Un titre n'a pas de dessin : son nom suffit. */
  const art = (slot: Exclude<CosmeticSlot, "title">, id: string | null): ReactNode => {
    if (slot === "frame") return <FrameArt id={id} />;
    if (slot === "flag") return <FlagArt id={id} className="h-12 w-[72px]" />;
    return <ShipArt id={id} flag={equipped.flag} className="h-[66px] w-[88px]" />;
  };

  const item = (slot: CosmeticSlot, cosmetic: Cosmetic | null): ReactNode => {
    const id = cosmetic?.id ?? null;
    const name = cosmetic ? cosmetic.name[locale] : COSMETIC_DEFAULTS[slot][locale];
    const has = cosmetic === null || owned.includes(cosmetic.id);
    const worn = (equipped[slot] ?? null) === id;
    const key = `${slot}:${id}`;
    return (
      <li key={key} className={`flex flex-col items-center gap-2.5 rounded-2xl p-3.5 text-center ${worn ? "border-2 border-straw bg-straw/5" : "border border-sea-700 bg-sea-800"}`}>
        {slot !== "title" && <div className="flex h-[70px] items-center justify-center">{art(slot, id)}</div>}
        <p className={`text-[15px] leading-tight font-extrabold text-foam ${slot === "title" ? "flex min-h-12 items-center" : ""}`}>{name}</p>
        {worn ? (
          <p className="mt-auto flex min-h-10 items-center text-sm font-extrabold text-straw">{t("Porté", "Equipped")}</p>
        ) : has ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run(key, () => wear(slot, id))}
            className="mt-auto min-h-10 w-full cursor-pointer rounded-lg border border-straw px-3 text-sm font-extrabold text-straw hover:bg-straw/10 disabled:opacity-50"
          >
            {t("Porter", "Equip")}
          </button>
        ) : cosmetic.price === null ? (
          <p className="mt-auto min-h-10 text-xs text-mist">{cosmetic.earned?.[locale]}</p>
        ) : (
          <button
            type="button"
            disabled={busy !== null || state.berrys < cosmetic.price}
            onClick={() => run(key, () => buyLook(cosmetic.id))}
            className="mt-auto min-h-10 w-full cursor-pointer rounded-lg bg-straw px-3 text-sm font-extrabold text-ink hover:bg-straw-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === key ? t("Achat…", "Buying…") : `${formatNumber(cosmetic.price, locale)} ฿`}
          </button>
        )}
      </li>
    );
  };

  return (
    <section aria-labelledby="cosmetiques" className="space-y-5 rounded-2xl border border-sea-700 p-5">
      <div>
        <h2 id="cosmetiques" className="text-lg font-extrabold text-foam">
          {t("Cosmétiques", "Cosmetics")}
        </h2>
        <p className="text-sm text-mist">
          {t(
            "Ils ne changent rien au jeu : ils habillent ton avis de recherche, ton navire et ton nom dans les classements. Un cosmétique acheté est à toi pour de bon.",
            "They change nothing about the game: they dress up your wanted poster, your ship and your name on the leaderboards. A cosmetic you buy is yours for good.",
          )}
        </p>
      </div>
      {error && (
        <p role="alert" className="font-semibold text-vest">
          {error}
        </p>
      )}
      {COSMETIC_SLOTS.map((slot) => (
        <div key={slot} className="space-y-2.5">
          <h3 className="text-xs font-extrabold tracking-[0.15em] text-mist uppercase">{COSMETIC_SLOT_LABELS[slot][locale]}</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {item(slot, null)}
            {COSMETICS.filter((cosmetic) => cosmetic.slot === slot).map((cosmetic) => item(slot, cosmetic))}
          </ul>
        </div>
      ))}
    </section>
  );
}
