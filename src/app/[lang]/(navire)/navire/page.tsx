import type { Metadata } from "next";
import { CrewView } from "@/components/CrewView";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Mon équipage", "My crew"),
    description: t(
      "Les dix postes de ton navire, leurs bonus et les traits de ton équipage.",
      "Your ship's ten posts, their bonuses and your crew's traits.",
    ),
    robots: { index: false },
  };
}

export default function CrewPage() {
  return <CrewView />;
}
