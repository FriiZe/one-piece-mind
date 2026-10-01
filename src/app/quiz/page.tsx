import type { Metadata } from "next";
import Link from "next/link";
import { QuizHome } from "@/components/quiz/QuizHome";
import { TogetherTabs } from "@/components/TogetherTabs";
import { COMMUNITY_BERRYS } from "@/lib/quiz/rules";

export const metadata: Metadata = {
  title: "Quiz de la commu : des quiz One Piece créés par les joueurs",
  description:
    "Des quiz One Piece écrits par les joueurs, à jouer en Duo, Carré ou Cash : deux propositions, quatre, ou aucune. Crée le tien et partage-le.",
  alternates: { canonical: "/quiz" },
};

export default function QuizPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:py-8">
      <TogetherTabs />
      <header>
        <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">Quiz de la commu</h1>
        <p className="mt-0.5 max-w-3xl text-mist">
          Écrits par les joueurs. Le premier passage sur un quiz rapporte jusqu&apos;à {COMMUNITY_BERRYS} ฿. Pour les questions du site avec
          les mêmes règles, c&apos;est{" "}
          <Link href="/jeux/duo-carre-cash" className="font-bold text-straw underline underline-offset-4">
            par ici
          </Link>
          .
        </p>
      </header>
      <QuizHome />
    </div>
  );
}
