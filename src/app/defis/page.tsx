import type { Metadata } from "next";
import { ChallengesView } from "@/components/ChallengesView";

export const metadata: Metadata = {
  title: "Défis One Piece du jour et de la semaine",
  description:
    "Le défi One Piece du jour, identique pour tous les joueurs, et trois défis qui changent chaque lundi : des Berrys et des personnages à gagner.",
  alternates: { canonical: "/defis" },
};

export default function ChallengesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10">
      <header>
        <h1 className="font-display text-5xl tracking-wide text-foam">Défis</h1>
        <p className="mt-2 max-w-2xl text-lg text-mist">
          Un défi par jour, trois par semaine. Ils rapportent plus que les parties ordinaires.
        </p>
      </header>
      <ChallengesView />
    </div>
  );
}
