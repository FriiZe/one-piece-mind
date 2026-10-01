import type { ReactNode } from "react";
import Link from "@/components/Link";
import { getT } from "@/lib/i18n/server";

/** Titre et rubriques de l'administration, en tête de chacune de ses pages. */
export async function AdminHeader({ current }: { current: "overview" | "players" }) {
  const t = await getT();
  const tabs = [
    { id: "overview", href: "/admin", label: t("Vue d'ensemble", "Overview") },
    { id: "players", href: "/admin/joueurs", label: t("Joueurs", "Players") },
  ];
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <p className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">{t("Administration", "Administration")}</p>
      <nav aria-label={t("Rubriques de l'administration", "Administration sections")} className="flex gap-2 text-sm font-bold">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={tab.id === current ? "page" : undefined}
            className={pill(tab.id === current)}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

/** Bouton arrondi d'un choix (rubrique, période, tri) ; plein quand c'est le choix en cours. */
export const pill = (selected: boolean) =>
  `rounded-full border px-3.5 py-1.5 whitespace-nowrap transition-colors ${
    selected ? "border-straw bg-straw text-ink" : "border-sea-600 text-mist hover:border-straw hover:text-foam"
  }`;

/** Un chiffre et ce qu'il compte. */
export function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-sea-700 bg-sea-800 px-4 py-3.5">
      <dt className="text-sm font-bold text-mist">{label}</dt>
      <dd className="text-[28px] leading-tight font-extrabold text-foam">{value}</dd>
      {hint && <dd className="text-[13px] text-mist">{hint}</dd>}
    </div>
  );
}

export const TABLE = {
  wrapper: "overflow-x-auto rounded-2xl border border-sea-700 bg-sea-800",
  table: "w-full text-left text-sm whitespace-nowrap",
  head: "text-[13px] text-mist [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-bold",
  body: "[&_td]:px-4 [&_td]:py-2.5 [&_tr]:border-t [&_tr]:border-sea-700",
  number: "text-right tabular-nums",
};
