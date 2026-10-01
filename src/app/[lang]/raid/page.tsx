import type { Metadata } from "next";
import { RaidView } from "@/components/raid/RaidView";
import { TogetherTabs } from "@/components/TogetherTabs";
import { translator } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = translator(locale);
  return pageMetadata({
    locale,
    title: t("Raid : toute la communauté contre un Empereur", "Raid: the whole community against an Emperor"),
    description: t(
      "Chaque semaine, tous les joueurs affrontent le même adversaire, un Empereur ou un Amiral. Chaque bonne réponse à un quiz One Piece lui retire des points de vie ; s'il tombe, tout l'équipage se partage le butin.",
      "Every week, all players take on the same boss, an Emperor or an Admiral. Every right answer in a One Piece quiz chips away at its hit points; if it falls, the whole crew shares the loot.",
    ),
    path: "/raid",
  });
}

export default async function RaidPage() {
  const t = await getT();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:py-8">
      <TogetherTabs />
      <header>
        <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">{t("Raid de la semaine", "Raid of the week")}</h1>
        <p className="mt-0.5 max-w-2xl text-mist">
          {t(
            "Un seul adversaire pour tout le monde, du lundi au dimanche. Trois assauts par jour : chaque bonne réponse compte, et ton équipage frappe avec toi.",
            "One boss for everyone, Monday to Sunday. Three assaults a day: every right answer counts, and your crew hits alongside you.",
          )}
        </p>
      </header>
      <RaidView />
    </div>
  );
}
