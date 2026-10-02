import type { Metadata } from "next";
import { ChallengesView } from "@/components/ChallengesView";
import { translator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = translator(locale);
  return pageMetadata({
    locale,
    title: t("Défis One Piece : quotidiens, de la semaine et objectifs", "One Piece challenges: daily, weekly and goals"),
    description: t(
      "Les jeux One Piece du jour, quatre défis quotidiens, six défis qui changent chaque lundi et les objectifs de chaque jeu : des Berrys et des personnages à gagner.",
      "Today's One Piece games, four daily challenges, six challenges that change every Monday and the goals of every game: Berries and characters to win.",
    ),
    path: "/defis",
  });
}

export default function ChallengesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:py-8">
      <ChallengesView />
    </div>
  );
}
