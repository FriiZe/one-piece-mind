import type { Metadata } from "next";
import { GlobalLeaderboard } from "@/components/Leaderboards";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Classement des joueurs", "Player leaderboard"),
    description: t(
      "Les joueurs de OnePieceMind classés par prime : le total des Berrys gagnés depuis leur inscription.",
      "OnePieceMind players ranked by bounty: the total Berries earned since they signed up.",
    ),
  };
}

export default async function LeaderboardPage() {
  const t = await getT();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:py-8">
      <header>
        <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">{t("Classement", "Leaderboard")}</h1>
        <p className="mt-1 max-w-3xl text-mist">
          {t(
            "Les joueurs par prime, c'est-à-dire par total de Berrys gagnés depuis leur inscription. Chaque jeu a aussi son classement du jour, de la semaine et du mois, sur sa page.",
            "Players by bounty, that is by total Berries earned since they signed up. Every game also has its own daily, weekly and monthly leaderboard, on its page.",
          )}
        </p>
      </header>
      <GlobalLeaderboard />
    </div>
  );
}
