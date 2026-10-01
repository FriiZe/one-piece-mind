import type { Metadata } from "next";
import { QuizPlayer } from "@/components/quiz/QuizPlayer";
import { getT } from "@/lib/i18n/server";

// Les quiz sont écrits par les joueurs : leur contenu n'est pas proposé aux moteurs de recherche
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Quiz de la commu", "Community quiz"), robots: { index: false } };
}

export default async function QuizPlayPage({ params }: PageProps<"/[lang]/quiz/[id]">) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <QuizPlayer id={id} />
    </div>
  );
}
