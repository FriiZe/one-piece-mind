import type { Metadata } from "next";
import Link from "@/components/Link";
import { QuizHome } from "@/components/quiz/QuizHome";
import { TogetherTabs } from "@/components/TogetherTabs";
import { translator } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import { COMMUNITY_BERRYS } from "@/lib/quiz/rules";
import { pageMetadata } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = translator(locale);
  return pageMetadata({
    locale,
    title: t("Quiz de la commu : des quiz One Piece créés par les joueurs", "Community quizzes: One Piece quizzes made by players"),
    description: t(
      "Des quiz One Piece écrits par les joueurs, à jouer en Duo, Carré ou Cash : deux propositions, quatre, ou aucune. Crée le tien et partage-le.",
      "One Piece quizzes written by players, played Duo, Quad or Cash style: two choices, four, or none. Create your own and share it.",
    ),
    path: "/quiz",
  });
}

export default async function QuizPage() {
  const t = await getT();
  const link = "font-bold text-straw underline underline-offset-4";
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:py-8">
      <TogetherTabs />
      <header>
        <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">{t("Quiz de la commu", "Community quizzes")}</h1>
        <p className="mt-0.5 max-w-3xl text-mist">
          {t(
            <>
              Écrits par les joueurs. Le premier passage sur un quiz rapporte jusqu&apos;à {COMMUNITY_BERRYS} ฿. Pour les questions du site
              avec les mêmes règles, c&apos;est{" "}
              <Link href="/jeux/duo-carre-cash" className={link}>
                par ici
              </Link>
              .
            </>,
            <>
              Written by players. Your first run through a quiz earns up to {COMMUNITY_BERRYS} ฿. For the site&apos;s own questions with the
              same rules, head{" "}
              <Link href="/jeux/duo-carre-cash" className={link}>
                this way
              </Link>
              .
            </>,
          )}
        </p>
      </header>
      <QuizHome />
    </div>
  );
}
