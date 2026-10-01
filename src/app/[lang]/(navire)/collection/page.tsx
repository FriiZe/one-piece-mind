import type { Metadata } from "next";
import { CollectionView } from "@/components/CollectionView";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Ma collection", "My collection"),
    description: t(
      "Les avis de recherche que tu as recrutés en jouant, et tes doublons à défaire.",
      "The wanted posters you recruited by playing, and your duplicates to scrap.",
    ),
    robots: { index: false },
  };
}

export default function CollectionPage() {
  return <CollectionView />;
}
