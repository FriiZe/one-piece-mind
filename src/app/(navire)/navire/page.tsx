import type { Metadata } from "next";
import { CrewView } from "@/components/CrewView";

export const metadata: Metadata = {
  title: "Mon équipage",
  description: "Les dix postes de ton navire, leurs bonus et les traits de ton équipage.",
  robots: { index: false },
};

export default function CrewPage() {
  return <CrewView />;
}
