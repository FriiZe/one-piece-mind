import type { Metadata } from "next";
import Link from "next/link";
import { QuizEditor } from "@/components/quiz/QuizEditor";

export const metadata: Metadata = {
  title: "Créer un quiz",
  robots: { index: false },
};

export default function CreateQuizPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <header>
        <nav aria-label="Fil d'Ariane" className="text-sm text-mist">
          <Link href="/quiz" className="underline underline-offset-4 hover:text-foam">
            Quiz de la commu
          </Link>
        </nav>
        <h1 className="mt-1 font-display text-5xl tracking-wide text-foam">Créer un quiz</h1>
      </header>
      <QuizEditor />
    </div>
  );
}
