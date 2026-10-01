import type { Metadata } from "next";
import { CollectionView } from "@/components/CollectionView";

export const metadata: Metadata = {
  title: "Ma collection",
  description: "Les avis de recherche que tu as recrutés en jouant, et tes doublons à défaire.",
  robots: { index: false },
};

export default function CollectionPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
      <header>
        <h1 className="font-display text-5xl tracking-wide text-foam">Ma collection</h1>
        <p className="mt-2 max-w-2xl text-lg text-mist">
          Chaque bonne partie peut te faire recruter un personnage. Place ensuite tes recrues aux postes de ton équipage
          pour gagner davantage.
        </p>
      </header>
      <CollectionView />
    </div>
  );
}
