import type { Metadata } from "next";
import { MultiHome } from "@/components/multi/MultiHome";
import { TogetherTabs } from "@/components/TogetherTabs";
import { translator } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = translator(locale);
  return pageMetadata({
    locale,
    title: t("Multijoueur : un quiz One Piece entre amis", "Multiplayer: a One Piece quiz with friends"),
    description: t(
      "Crée un salon, partage son code et affronte tes amis sur un quiz One Piece : mêmes questions pour tous, chrono commun et classement en direct. Sans inscription.",
      "Create a room, share its code and take on your friends in a One Piece quiz: same questions for everyone, a shared timer and a live leaderboard. No sign-up needed.",
    ),
    path: "/multi",
  });
}

export default async function MultiPage() {
  const t = await getT();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:py-8">
      <TogetherTabs />
      <header>
        <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">{t("Jouer à plusieurs", "Play together")}</h1>
        <p className="mt-0.5 max-w-2xl text-mist">
          {t(
            "Un salon, un code à partager : les mêmes questions, en même temps. Les bonnes réponses rapportent des points, les réponses rapides encore plus.",
            "One room, one code to share: the same questions, at the same time. Right answers score points, fast answers score even more.",
          )}
        </p>
      </header>
      <MultiHome />
    </div>
  );
}
