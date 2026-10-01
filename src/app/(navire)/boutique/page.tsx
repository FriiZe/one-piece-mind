import type { Metadata } from "next";
import { ShopView } from "@/components/ShopView";

export const metadata: Metadata = {
  title: "La boutique",
  description: "Dépense tes Berrys : une recrue au hasard, ou un booster de cinq avis de recherche à ouvrir.",
  robots: { index: false },
};

export default function ShopPage() {
  return <ShopView />;
}
