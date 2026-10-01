"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { formatNumber } from "@/games/engine/text";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { useDaily } from "@/lib/player/useDaily";
import { SITE_NAME } from "@/lib/site";
import { NotificationBell } from "./NotificationBell";

/** Pages du navire : équipage, collection, boutique, échanges. */
const SHIP_PATHS = ["/navire", "/collection", "/boutique", "/echanges"];
const under = (pathname: string, ...roots: string[]) => roots.some((root) => pathname === root || pathname.startsWith(`${root}/`));

const LINKS = [
  { href: "/jeux", label: "Jeux", active: (pathname: string) => under(pathname, "/jeux") },
  { href: "/multi", label: "Multi", active: (pathname: string) => under(pathname, "/multi") },
  { href: "/quiz", label: "Quiz", active: (pathname: string) => under(pathname, "/quiz") },
  { href: "/navire", label: "Mon navire", active: (pathname: string) => under(pathname, ...SHIP_PATHS) },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[22px]">
      {children}
    </svg>
  );
}

const TABS = [
  {
    href: "/",
    label: "Aujourd'hui",
    active: (pathname: string) => pathname === "/" || under(pathname, "/defis"),
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
      </>
    ),
  },
  {
    href: "/jeux",
    label: "Jeux",
    active: (pathname: string) => under(pathname, "/jeux"),
    icon: (
      <>
        <rect x="2" y="7" width="20" height="11" rx="4" />
        <path d="M7 11v3M5.5 12.5h3M16 11.5h.01M18 13.5h.01" />
      </>
    ),
  },
  {
    href: "/navire",
    label: "Navire",
    active: (pathname: string) => under(pathname, ...SHIP_PATHS),
    icon: (
      <>
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v14M5 13a7 7 0 0 0 14 0M8 11h8" />
      </>
    ),
  },
  {
    href: "/multi",
    label: "À plusieurs",
    active: (pathname: string) => under(pathname, "/multi", "/quiz"),
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2 20a7 7 0 0 1 14 0M17 5a3.5 3.5 0 0 1 0 7M18 14a7 7 0 0 1 4 6" />
      </>
    ),
  },
  {
    href: "/profil",
    label: "Moi",
    active: (pathname: string) => under(pathname, "/profil"),
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
  },
];

/** Avancement des jeux du jour : toujours sous les yeux, il mène aux défis. */
function DailyPill() {
  const { ready, count, total } = useDaily();
  const pathname = usePathname();
  const current = under(pathname, "/defis");
  return (
    <Link
      href="/defis"
      aria-label={`Jeux du jour : ${count} validés sur ${total}`}
      aria-current={current ? "page" : undefined}
      className={`rounded-full border border-straw px-3 py-1.5 whitespace-nowrap transition-colors ${
        current ? "bg-straw text-ink" : "text-straw hover:bg-straw/15"
      }`}
    >
      Jour <span className={ready ? "" : "invisible"}>{count}</span>/{total}
    </Link>
  );
}

/** En-tête du site. Sur téléphone, les rubriques passent dans la barre d'onglets du bas. */
export function SiteHeader() {
  const { status, accountsEnabled, state, username } = usePlayer();
  const pathname = usePathname();

  return (
    <header className="border-b border-sea-700/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:h-16 md:gap-7">
        <Link href="/" className="font-display text-[22px] tracking-wide text-straw md:text-[26px]">
          {SITE_NAME}
        </Link>
        <nav aria-label="Navigation principale" className="hidden items-center gap-6 text-[15px] font-bold text-mist md:flex">
          {LINKS.map((link) => {
            const active = link.active(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`border-b-2 py-1 transition-colors hover:text-foam ${active ? "border-straw text-foam" : "border-transparent"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 text-sm font-bold md:gap-3">
          <DailyPill />
          {/* Le solde n'est connu qu'une fois le navigateur prêt : on réserve sa place pour éviter un saut */}
          <Link
            href="/boutique"
            aria-label={`${formatNumber(state.berrys)} Berrys, aller à la boutique`}
            className={`whitespace-nowrap hover:text-straw ${status === "loading" ? "invisible" : ""}`}
          >
            ฿ {formatNumber(state.berrys)}
          </Link>
          <NotificationBell />
          {status === "user" && (
            <Link
              href="/profil"
              aria-current={under(pathname, "/profil") ? "page" : undefined}
              className="hidden items-center gap-2 rounded-full border border-sea-600 px-3.5 py-1.5 hover:border-straw md:flex"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
              <span className="max-w-40 truncate">{username}</span>
            </Link>
          )}
          {status === "guest" && accountsEnabled && (
            <Link href="/profil" className="rounded-full bg-straw px-4 py-1.5 whitespace-nowrap text-ink hover:bg-straw-dark">
              Connexion
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/** Barre d'onglets du téléphone, fixée en bas de l'écran. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Rubriques"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-sea-700 bg-sea-900 pb-[env(safe-area-inset-bottom)] text-[11px] font-bold text-mist md:hidden"
    >
      {TABS.map((tab) => {
        const active = tab.active(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-[68px] flex-col items-center justify-center gap-1 ${active ? "text-straw" : "hover:text-foam"}`}
          >
            <Icon>{tab.icon}</Icon>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
