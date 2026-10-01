import type { Metadata } from "next";
import { CollectionView } from "@/components/CollectionView";

export const metadata: Metadata = {
  title: "Ma collection",
  description: "Les avis de recherche que tu as recrutés en jouant, et tes doublons à défaire.",
  robots: { index: false },
};

export default function CollectionPage() {
  return <CollectionView />;
}
