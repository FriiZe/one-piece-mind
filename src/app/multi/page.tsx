import type { Metadata } from "next";
import { MultiHome } from "@/components/multi/MultiHome";

export const metadata: Metadata = {
  title: "Multijoueur : un quiz One Piece entre amis",
  description:
    "Crée un salon, partage son code et affronte tes amis sur un quiz One Piece : mêmes questions pour tous, chrono commun et classement en direct. Sans inscription.",
  alternates: { canonical: "/multi" },
};

export default function MultiPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
      <header>
        <h1 className="font-display text-5xl tracking-wide text-foam">Multijoueur</h1>
        <p className="mt-2 max-w-2xl text-lg text-mist">
          Un salon, un code à partager, et tout le monde répond aux mêmes questions en même temps. Les bonnes réponses
          rapportent des points, les réponses rapides encore plus.
        </p>
      </header>
      <MultiHome />
    </div>
  );
}
