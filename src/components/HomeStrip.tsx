"use client";

import Link from "@/components/Link";
import { formatNumber } from "@/games/engine/text";
import { playerBounty, RANKS, rankOf } from "@/lib/economy";
import { INTL_LOCALES, type Localized } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { useWeekly } from "@/lib/player/useDaily";

const compact: Localized<Intl.NumberFormat> = {
  fr: new Intl.NumberFormat(INTL_LOCALES.fr, { notation: "compact", maximumFractionDigits: 1 }),
  en: new Intl.NumberFormat(INTL_LOCALES.en, { notation: "compact", maximumFractionDigits: 1 }),
};

function BountyCard() {
  const { state, status } = usePlayer();
  const t = useT();
  const locale = useLocale();
  const bounty = playerBounty(state);
  const rank = rankOf(bounty);
  const from = RANKS.find((r) => r.title === rank.title)?.from ?? 0;
  const progress = rank.next ? Math.min(1, (bounty - from) / (rank.next.from - from)) : 1;

  return (
    <Link href="/profil" className="flex flex-col gap-2.5 rounded-2xl bg-parchment p-4 text-ink transition-opacity hover:opacity-90">
      <span className="text-xs font-extrabold tracking-[0.15em] uppercase">{t("Ta prime", "Your bounty")}</span>
      <span className={`font-display text-[26px] leading-none tracking-wide ${status === "loading" ? "invisible" : ""}`}>
        ฿ {formatNumber(bounty, locale)}
      </span>
      <span className="mt-auto block h-2 overflow-hidden rounded-full bg-parchment-dark">
        <span className="block h-full bg-ink" style={{ width: `${progress * 100}%` }} />
      </span>
      <span className={`flex justify-between gap-2 text-[13px] font-bold ${status === "loading" ? "invisible" : ""}`}>
        <span>{rank.title[locale]}</span>
        <span>
          {rank.next
            ? t(
                `${rank.next.title.fr} à ${compact.fr.format(rank.next.from)}`,
                `${rank.next.title.en} at ${compact.en.format(rank.next.from)}`,
              )
            : t("Rang le plus élevé", "Highest rank")}
        </span>
      </span>
    </Link>
  );
}

/** Défis de la semaine montrés sur l'accueil : la page Défis les liste tous. */
const HOME_CHALLENGES = 3;

/** Sous les jeux du jour : trois défis de la semaine, ceux qui restent à faire d'abord, et la prime du joueur. */
export function HomeStrip() {
  const weekly = useWeekly();
  const { ready } = weekly;
  const challenges = [...weekly.challenges.filter((challenge) => !challenge.done), ...weekly.challenges.filter((challenge) => challenge.done)].slice(
    0,
    HOME_CHALLENGES,
  );
  const t = useT();
  const locale = useLocale();

  return (
    <section
      aria-label={t("Défis de la semaine et prime", "Weekly challenges and bounty")}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {challenges.map((challenge, index) => {
        if (!ready) return <div key={index} className="h-[132px] rounded-2xl border border-sea-700 bg-sea-800/50" aria-hidden="true" />;
        const href = challenge.slug && !challenge.done ? `/jeux/${challenge.slug}` : "/defis";
        return (
          <Link
            key={challenge.label.fr}
            href={href}
            className={`flex flex-col gap-2.5 rounded-2xl border p-4 transition-colors ${
              challenge.done ? "border-emerald-400/40 bg-emerald-600/15" : "border-sea-700 bg-sea-800 hover:border-straw"
            }`}
          >
            <span className={`text-xs font-extrabold tracking-[0.15em] uppercase ${challenge.done ? "text-emerald-300" : "text-mist"}`}>
              {challenge.done ? t("Défi réussi", "Challenge completed") : t("Défi de la semaine", "Weekly challenge")}
            </span>
            <span className="text-[15px] font-bold text-foam">{challenge.label[locale]}</span>
            <span className="mt-auto block h-2 overflow-hidden rounded-full bg-sea-900">
              <span
                className={`block h-full ${challenge.done ? "bg-emerald-300" : "bg-straw"}`}
                style={{ width: `${(challenge.value / challenge.target) * 100}%` }}
              />
            </span>
            <span className="flex justify-between gap-2 text-[13px] font-bold">
              <span className="text-mist">
                {formatNumber(challenge.value, locale)} / {formatNumber(challenge.target, locale)}
              </span>
              <span className={challenge.done ? "text-emerald-300" : "text-straw"}>+{formatNumber(challenge.berrys, locale)} ฿</span>
            </span>
          </Link>
        );
      })}
      <BountyCard />
    </section>
  );
}
