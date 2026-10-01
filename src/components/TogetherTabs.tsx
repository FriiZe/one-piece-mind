"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/multi", label: "Salons" },
  { href: "/quiz", label: "Quiz de la commu" },
];

/** Sur téléphone, l'onglet « À plusieurs » réunit les salons et les quiz de la commu : on passe de l'un à l'autre ici. */
export function TogetherTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="À plusieurs" className="grid grid-cols-2 rounded-xl bg-sea-800 p-1 text-[15px] font-extrabold md:hidden">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-[9px] ${active ? "bg-straw text-ink" : "text-mist"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
