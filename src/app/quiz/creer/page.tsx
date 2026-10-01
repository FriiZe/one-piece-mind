import type { Metadata } from "next";
import Link from "next/link";
import { QuizEditor } from "@/components/quiz/QuizEditor";

export const metadata: Metadata = {
  title: "Créer un quiz",
  robots: { index: false },
};

export default function CreateQuizPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-7 sm:py-8">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <nav aria-label="Fil d'Ariane" className="text-sm font-bold text-mist">
          <Link href="/quiz" className="underline underline-offset-4 hover:text-foam">
            Quiz de la commu
          </Link>
        </nav>
        <h1 className="font-display text-[32px] tracking-wide text-foam">Nouveau quiz</h1>
      </header>
      <QuizEditor />
    </div>
  );
}
