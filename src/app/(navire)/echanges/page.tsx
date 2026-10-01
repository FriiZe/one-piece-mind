import type { Metadata } from "next";
import { TradesView } from "@/components/TradesView";

export const metadata: Metadata = {
  title: "Échanges",
  description: "Échange des avis de recherche avec tes amis.",
  robots: { index: false },
};

export default function TradesPage() {
  return <TradesView />;
}
