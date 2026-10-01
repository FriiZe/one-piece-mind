import type { Metadata } from "next";
import { QuizPlayer } from "@/components/quiz/QuizPlayer";

// Les quiz sont écrits par les joueurs : leur contenu n'est pas proposé aux moteurs de recherche
export const metadata: Metadata = {
  title: "Quiz de la commu",
  robots: { index: false },
};

export default async function QuizPlayPage({ params }: PageProps<"/quiz/[id]">) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <QuizPlayer id={id} />
    </div>
  );
}
