"use client";

import Link from "@/components/Link";
import { usePath, useT } from "@/lib/i18n/client";

const TABS = [
  { href: "/multi", label: { fr: "Salons", en: "Rooms" } },
  { href: "/classe", label: { fr: "Classé", en: "Ranked" } },
  { href: "/raid", label: { fr: "Raid", en: "Raid" } },
  { href: "/quiz", label: { fr: "Quiz", en: "Quizzes" } },
];

/**
 * Les façons de jouer à plusieurs : salons, classé, raid et quiz de la commu.
 * Sur téléphone, elles tiennent toutes dans l'onglet « À plusieurs ». Sur
 * ordinateur, les quiz ont leur lien dans l'en-tête : la barre ne réunit que
 * les trois autres, et disparaît sur les pages de quiz.
 */
export function TogetherTabs() {
  const pathname = usePath();
  const t = useT();
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav
      aria-label={t("À plusieurs", "Together")}
      className={`grid grid-cols-4 rounded-xl bg-sea-800 p-1 text-[15px] font-extrabold md:w-fit md:grid-cols-3 ${under("/quiz") ? "md:hidden" : ""}`}
    >
      {TABS.map((tab) => {
        const active = under(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-[9px] md:px-6 ${tab.href === "/quiz" ? "md:hidden" : ""} ${
              active ? "bg-straw text-ink" : "text-mist hover:text-foam"
            }`}
          >
            {t(tab.label.fr, tab.label.en)}
          </Link>
        );
      })}
    </nav>
  );
}
