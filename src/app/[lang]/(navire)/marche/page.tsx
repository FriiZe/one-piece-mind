import type { Metadata } from "next";
import { MarketView } from "@/components/MarketView";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Le marché", "The market"),
    description: t(
      "Vends tes avis de recherche en trop aux autres joueurs, et achète ceux qui te manquent.",
      "Sell your spare wanted posters to other players, and buy the ones you're missing.",
    ),
    robots: { index: false },
  };
}

export default function MarketPage() {
  return <MarketView />;
}
