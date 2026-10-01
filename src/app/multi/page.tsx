import type { Metadata } from "next";
import { MultiHome } from "@/components/multi/MultiHome";
import { TogetherTabs } from "@/components/TogetherTabs";

export const metadata: Metadata = {
  title: "Multijoueur : un quiz One Piece entre amis",
  description:
    "Crée un salon, partage son code et affronte tes amis sur un quiz One Piece : mêmes questions pour tous, chrono commun et classement en direct. Sans inscription.",
  alternates: { canonical: "/multi" },
};

export default function MultiPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:py-8">
      <TogetherTabs />
      <header>
        <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">Jouer à plusieurs</h1>
        <p className="mt-0.5 max-w-2xl text-mist">
          Un salon, un code à partager : les mêmes questions, en même temps. Les bonnes réponses rapportent des points, les réponses rapides
          encore plus.
        </p>
      </header>
      <MultiHome />
    </div>
  );
}
