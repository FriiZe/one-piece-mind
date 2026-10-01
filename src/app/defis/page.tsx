import type { Metadata } from "next";
import { ChallengesView } from "@/components/ChallengesView";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Défis One Piece du jour et de la semaine",
  description:
    "Le défi One Piece du jour, identique pour tous les joueurs, et trois défis qui changent chaque lundi : des Berrys et des personnages à gagner.",
  path: "/defis",
});

export default function ChallengesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:py-8">
      <ChallengesView />
    </div>
  );
}
