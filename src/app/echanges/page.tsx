import type { Metadata } from "next";
import { TradesView } from "@/components/TradesView";

export const metadata: Metadata = {
  title: "Échanges",
  description: "Échange des avis de recherche avec tes amis.",
  robots: { index: false },
};

export default function TradesPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
      <header>
        <h1 className="font-display text-5xl tracking-wide text-foam">Échanges</h1>
        <p className="mt-2 max-w-2xl text-lg text-mist">
          Un doublon en trop, un avis qui te manque : propose un échange à un ami, un avis contre un avis.
        </p>
      </header>
      <TradesView />
    </div>
  );
}
