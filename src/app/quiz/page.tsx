import type { Metadata } from "next";
import Link from "next/link";
import { QuizHome } from "@/components/quiz/QuizHome";

export const metadata: Metadata = {
  title: "Quiz de la commu : des quiz One Piece créés par les joueurs",
  description:
    "Des quiz One Piece écrits par les joueurs, à jouer en Duo, Carré ou Cash : deux propositions, quatre, ou aucune. Crée le tien et partage-le.",
  alternates: { canonical: "/quiz" },
};

export default function QuizPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
      <header>
        <h1 className="font-display text-5xl tracking-wide text-foam">Quiz de la commu</h1>
        <p className="mt-2 max-w-2xl text-lg text-mist">
          Des quiz écrits par les joueurs, à jouer en Duo, Carré ou Cash. Pour les questions du site avec les mêmes
          règles, c&apos;est{" "}
          <Link href="/jeux/duo-carre-cash" className="font-semibold text-straw underline underline-offset-4">
            par ici
          </Link>
          .
        </p>
      </header>
      <QuizHome />
    </div>
  );
}
