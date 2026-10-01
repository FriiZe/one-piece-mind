import type { ReactNode } from "react";
import Link from "@/components/Link";
import { translator, type Locale } from "@/lib/i18n";
import { MAX_PLAYERS } from "@/lib/multi/rules";
import { RAID_ATTACKS_PER_DAY } from "@/lib/raid/rules";
import { LEAGUES, RANKED_SETTINGS } from "@/lib/ranked/rules";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-6">
      {children}
    </svg>
  );
}

/** Sur l'accueil : les quatre façons de jouer à plusieurs, les mêmes que dans `TogetherTabs`. */
export function HomeTogether({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const firstLeague = LEAGUES[0].title[locale];
  const lastLeague = LEAGUES[LEAGUES.length - 1].title[locale];

  const modes = [
    {
      href: "/multi",
      tone: "bg-[#1d4a63] text-[#8fd0f0]",
      kicker: t("Entre amis", "With friends"),
      title: t("Salons", "Rooms"),
      pitch: t(
        `Un code à partager, les mêmes questions en même temps, jusqu'à ${MAX_PLAYERS} joueurs. Sans inscription.`,
        `One code to share, the same questions at the same time, up to ${MAX_PLAYERS} players. No sign-up needed.`,
      ),
      action: t("Créer un salon", "Create a room"),
      icon: (
        <>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2 20a7 7 0 0 1 14 0M17 5a3.5 3.5 0 0 1 0 7M18 14a7 7 0 0 1 4 6" />
        </>
      ),
    },
    {
      href: "/classe",
      tone: "bg-[#5a2f24] text-[#f5a88a]",
      kicker: t("Un contre un", "One on one"),
      title: t("Classé", "Ranked"),
      pitch: t(
        `${RANKED_SETTINGS.questionCount} questions face à un adversaire à ta mesure, une cote en jeu et ${LEAGUES.length} ligues, d'${firstLeague} à ${lastLeague}.`,
        `${RANKED_SETTINGS.questionCount} questions against an opponent at your level, rating points on the line and ${LEAGUES.length} leagues, from ${firstLeague} to ${lastLeague}.`,
      ),
      action: t("Lancer un duel", "Start a duel"),
      icon: <path d="M4 4l11 11M4 4v4M4 4h4M20 4L9 15M20 4v4M20 4h-4M6 14l-2 2 4 4 2-2M18 14l2 2-4 4-2-2" />,
    },
    {
      href: "/raid",
      tone: "bg-[#40295f] text-[#d2b0f5]",
      kicker: t("Toute la communauté", "The whole community"),
      title: t("Raid de la semaine", "Raid of the week"),
      pitch: t(
        `Un Empereur ou un Amiral à faire tomber tous ensemble : ${RAID_ATTACKS_PER_DAY} assauts par jour, et le butin se partage.`,
        `An Emperor or an Admiral to bring down together: ${RAID_ATTACKS_PER_DAY} assaults a day, and the loot is shared.`,
      ),
      action: t("Rejoindre le raid", "Join the raid"),
      icon: <path d="M5 21V4M5 4c5-2 7 2 13 0v9c-6 2-8-2-13 0" />,
    },
    {
      href: "/quiz",
      tone: "bg-[#1c4a44] text-[#8fe0d2]",
      kicker: t("Par les joueurs", "By players"),
      title: t("Quiz de la commu", "Community quizzes"),
      pitch: t(
        "Des quiz écrits par les joueurs, à jouer en Duo, Carré ou Cash. Écris le tien et partage-le.",
        "Quizzes written by players, played Duo, Quad or Cash style. Write your own and share it.",
      ),
      action: t("Voir les quiz", "Browse quizzes"),
      icon: <path d="M4 20l1-5L16 4l4 4L9 19zM14 6l4 4" />,
    },
  ];

  return (
    <section aria-labelledby="a-plusieurs-titre" className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="a-plusieurs-titre" className="font-display text-[28px] tracking-wide text-foam">
          {t("À plusieurs", "Play together")}
        </h2>
        <p className="text-mist">{t("Défie tes amis, un inconnu ou un Empereur.", "Take on your friends, a stranger or an Emperor.")}</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {modes.map((mode) => (
          <li key={mode.href} className="flex">
            <Link
              href={mode.href}
              className="group flex flex-1 flex-col gap-2 rounded-2xl border border-sea-700 bg-sea-800 p-4 transition-colors hover:border-straw"
            >
              <span className="flex items-center gap-3">
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${mode.tone}`}>
                  <Icon>{mode.icon}</Icon>
                </span>
                <span className="text-xs font-extrabold tracking-[0.15em] text-mist uppercase">{mode.kicker}</span>
              </span>
              <span className="font-display text-2xl leading-tight tracking-wide text-foam">{mode.title}</span>
              <span className="text-sm leading-6 text-mist">{mode.pitch}</span>
              <span className="mt-auto pt-1 text-sm font-extrabold text-straw group-hover:underline group-hover:underline-offset-4">
                {mode.action} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
