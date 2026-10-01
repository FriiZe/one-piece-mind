import type { Metadata } from "next";
import { TradesView } from "@/components/TradesView";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Échanges", "Trades"),
    description: t(
      "Échange des avis de recherche avec tes amis.",
      "Trade wanted posters with your friends.",
    ),
    robots: { index: false },
  };
}

export default function TradesPage() {
  return <TradesView />;
}
