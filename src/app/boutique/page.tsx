import type { Metadata } from "next";
import { ShopView } from "@/components/ShopView";

export const metadata: Metadata = {
  title: "La boutique",
  description: "Dépense tes Berrys : une recrue au hasard, ou un booster de cinq avis de recherche à ouvrir.",
  robots: { index: false },
};

export default function ShopPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
      <header>
        <h1 className="font-display text-5xl tracking-wide text-foam">La boutique</h1>
        <p className="mt-2 max-w-2xl text-lg text-mist">
          Les Berrys gagnés en jouant s&apos;échangent ici contre des avis de recherche : une recrue à l&apos;unité, ou
          un booster à ouvrir carte par carte.
        </p>
      </header>
      <ShopView />
    </div>
  );
}
