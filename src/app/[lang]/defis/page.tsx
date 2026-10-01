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
    title: t("Défis One Piece du jour et de la semaine", "Daily and weekly One Piece challenges"),
    description: t(
      "Le défi One Piece du jour, identique pour tous les joueurs, et trois défis qui changent chaque lundi : des Berrys et des personnages à gagner.",
      "The daily One Piece challenge, the same for every player, and three challenges that change every Monday: Berries and characters to win.",
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
