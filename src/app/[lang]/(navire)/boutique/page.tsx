import type { Metadata } from "next";
import { ShopView } from "@/components/ShopView";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("La boutique", "The shop"),
    description: t(
      "Dépense tes Berrys : une recrue au hasard, ou un booster de cinq avis de recherche à ouvrir.",
      "Spend your Berries: a random recruit, or a booster of five wanted posters to open.",
    ),
    robots: { index: false },
  };
}

export default function ShopPage() {
  return <ShopView />;
}
