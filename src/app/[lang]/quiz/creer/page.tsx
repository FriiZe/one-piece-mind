import type { Metadata } from "next";
import Link from "@/components/Link";
import { QuizEditor } from "@/components/quiz/QuizEditor";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Créer un quiz", "Create a quiz"), robots: { index: false } };
}

export default async function CreateQuizPage() {
  const t = await getT();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-7 sm:py-8">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <nav aria-label={t("Fil d'Ariane", "Breadcrumb")} className="text-sm font-bold text-mist">
          <Link href="/quiz" className="underline underline-offset-4 hover:text-foam">
            {t("Quiz de la commu", "Community quizzes")}
          </Link>
        </nav>
        <h1 className="font-display text-[32px] tracking-wide text-foam">{t("Nouveau quiz", "New quiz")}</h1>
      </header>
      <QuizEditor />
    </div>
  );
}
