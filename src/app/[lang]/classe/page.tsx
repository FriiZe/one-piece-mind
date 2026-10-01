import type { Metadata } from "next";
import { RankedHome } from "@/components/ranked/RankedHome";
import { TogetherTabs } from "@/components/TogetherTabs";
import { translator } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = translator(locale);
  return pageMetadata({
    locale,
    title: t("Classé : le duel One Piece à un contre un", "Ranked: the one-on-one One Piece duel"),
    description: t(
      "Affronte un autre joueur sur un quiz One Piece : dix questions, les mêmes pour les deux, une cote qui monte à chaque victoire, cinq ligues et une saison par mois.",
      "Take on another player in a One Piece quiz: ten questions, the same for both, a rating that climbs with every win, five leagues and a new season every month.",
    ),
    path: "/classe",
  });
}

export default async function RankedPage() {
  const t = await getT();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:py-8">
      <TogetherTabs />
      <header>
        <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">{t("Classé", "Ranked")}</h1>
        <p className="mt-0.5 max-w-2xl text-mist">
          {t(
            "Le Davy Back Fight : un adversaire à ta mesure, un quiz, et une cote en jeu. Grimpe d'East Blue à Laugh Tale avant la fin de la saison.",
            "The Davy Back Fight: an opponent at your level, a quiz, and rating points on the line. Climb from East Blue to Laugh Tale before the season ends.",
          )}
        </p>
      </header>
      <RankedHome />
    </div>
  );
}
