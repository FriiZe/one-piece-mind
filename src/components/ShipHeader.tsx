"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { spareCopies } from "@/lib/economy";
import { useNotifications } from "@/lib/multi/client";
import { usePlayer } from "@/lib/player/PlayerProvider";

const TABS = [
  { href: "/navire", label: "Équipage" },
  { href: "/collection", label: "Collection" },
  { href: "/boutique", label: "Boutique" },
  { href: "/echanges", label: "Échanges" },
];

/** En-tête commun aux pages du navire : ce que possède le joueur, et les quatre rubriques. */
export function ShipHeader() {
  const { state, status } = usePlayer();
  const pathname = usePathname();
  const counts = useNotifications(status === "user");

  const owned = Object.keys(state.collection).length;
  const spare = Object.values(state.collection).reduce((sum, entry) => {
    const copies = spareCopies(entry);
    return sum + copies.plain + copies.golden;
  }, 0);

  return (
    <header className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">Mon navire</h1>
        <p className={`flex flex-wrap gap-2 text-sm font-bold ${status === "loading" ? "invisible" : ""}`}>
          <span className="rounded-full border border-sea-700 px-3.5 py-2">
            {owned} avis recruté{owned > 1 ? "s" : ""}
          </span>
          {spare > 0 && (
            <Link href="/collection" className="rounded-full border border-straw/50 px-3.5 py-2 text-straw hover:bg-straw/10">
              {spare} doublon{spare > 1 ? "s" : ""} à défaire
            </Link>
          )}
        </p>
      </div>

      <nav aria-label="Mon navire" className="flex gap-4 overflow-x-auto border-b border-sea-700 text-[15px] font-extrabold text-mist [scrollbar-width:none] sm:gap-7 sm:text-base">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-[3px] pb-3 transition-colors hover:text-foam ${
                active ? "border-straw text-foam" : "border-transparent"
              }`}
            >
              {tab.label}
              {tab.href === "/echanges" && !!counts?.trades && (
                <span className="rounded-full bg-vest px-2 py-px text-xs text-white" aria-label={`${counts.trades} en attente`}>
                  {counts.trades}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
