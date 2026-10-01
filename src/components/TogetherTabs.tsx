"use client";

import Link from "@/components/Link";
import { usePath, useT } from "@/lib/i18n/client";

const TABS = [
  { href: "/multi", label: { fr: "Salons", en: "Rooms" } },
  { href: "/quiz", label: { fr: "Quiz de la commu", en: "Community quizzes" } },
];

/** Sur téléphone, l'onglet « À plusieurs » réunit les salons et les quiz de la commu : on passe de l'un à l'autre ici. */
export function TogetherTabs() {
  const pathname = usePath();
  const t = useT();
  return (
    <nav aria-label={t("À plusieurs", "Together")} className="grid grid-cols-2 rounded-xl bg-sea-800 p-1 text-[15px] font-extrabold md:hidden">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-[9px] ${active ? "bg-straw text-ink" : "text-mist"}`}
          >
            {t(tab.label.fr, tab.label.en)}
          </Link>
        );
      })}
    </nav>
  );
}
