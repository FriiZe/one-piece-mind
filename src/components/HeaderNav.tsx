"use client";

import type { ReactNode } from "react";
import Link from "@/components/Link";
import { formatNumber } from "@/games/engine/text";
import { useLocale, usePath, useT } from "@/lib/i18n/client";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { useDaily } from "@/lib/player/useDaily";
import { SITE_NAME } from "@/lib/site";
import { LanguageSwitch } from "./LanguageSwitch";
import { NotificationBell } from "./NotificationBell";

/** Pages du navire : équipage, collection, boutique, échanges, marché. */
const SHIP_PATHS = ["/navire", "/collection", "/boutique", "/echanges", "/marche"];
/** Pages où l'on joue avec ou contre d'autres joueurs : salons, classé, raid. */
const MULTI_PATHS = ["/multi", "/classe", "/raid"];
const under = (pathname: string, ...roots: string[]) => roots.some((root) => pathname === root || pathname.startsWith(`${root}/`));

const LINKS = [
  { href: "/jeux", label: { fr: "Jeux", en: "Games" }, active: (pathname: string) => under(pathname, "/jeux") },
  { href: "/defis", label: { fr: "Défis", en: "Challenges" }, active: (pathname: string) => under(pathname, "/defis") },
  { href: "/multi", label: { fr: "Multi", en: "Multi" }, active: (pathname: string) => under(pathname, ...MULTI_PATHS) },
  { href: "/quiz", label: { fr: "Quiz", en: "Quizzes" }, active: (pathname: string) => under(pathname, "/quiz") },
  { href: "/navire", label: { fr: "Mon navire", en: "My ship" }, active: (pathname: string) => under(pathname, ...SHIP_PATHS) },
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
    label: { fr: "Accueil", en: "Home" },
    active: (pathname: string) => pathname === "/",
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
      </>
    ),
  },
  {
    href: "/jeux",
    label: { fr: "Jeux", en: "Games" },
    active: (pathname: string) => under(pathname, "/jeux"),
    icon: (
      <>
        <rect x="2" y="7" width="20" height="11" rx="4" />
        <path d="M7 11v3M5.5 12.5h3M16 11.5h.01M18 13.5h.01" />
      </>
    ),
  },
  {
    href: "/defis",
    label: { fr: "Défis", en: "Goals" },
    active: (pathname: string) => under(pathname, "/defis"),
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
  },
  {
    href: "/navire",
    label: { fr: "Navire", en: "Ship" },
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
    label: { fr: "Multi", en: "Multi" },
    active: (pathname: string) => under(pathname, ...MULTI_PATHS, "/quiz"),
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2 20a7 7 0 0 1 14 0M17 5a3.5 3.5 0 0 1 0 7M18 14a7 7 0 0 1 4 6" />
      </>
    ),
  },
  {
    href: "/profil",
    label: { fr: "Moi", en: "Me" },
    active: (pathname: string) => under(pathname, "/profil"),
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
  },
];

/**
 * Avancement des jeux du jour : toujours sous les yeux, il mène aux défis. Quand la place manque
 * sur téléphone, il se réduit au compte : partout sur un écran étroit (moins de 400 px), et
 * dès qu'il partage l'en-tête avec le bouton « Connexion » (`compact`). Les deux à la fois, il
 * s'efface : l'onglet « Défis » de la barre du bas mène au même endroit.
 */
function DailyPill({ compact }: { compact: boolean }) {
  const { ready, count, total } = useDaily();
  const pathname = usePath();
  const t = useT();
  const current = under(pathname, "/defis");
  return (
    <Link
      href="/defis"
      aria-label={t(`Jeux du jour : ${count} validés sur ${total}`, `Daily games: ${count} cleared out of ${total}`)}
      aria-current={current ? "page" : undefined}
      className={`rounded-full border border-straw px-3 py-1.5 whitespace-nowrap transition-colors ${
        current ? "bg-straw text-ink" : "text-straw hover:bg-straw/15"
      } ${compact ? "max-[360px]:hidden" : ""}`}
    >
      <span className={compact ? "max-sm:hidden" : "max-[400px]:hidden"}>{t("Jour", "Daily")} </span>
      <span className={ready ? "" : "invisible"}>{count}</span>/{total}
    </Link>
  );
}

/**
 * En-tête du site. Sur téléphone et tablette (moins de 1024 px), les rubriques passent dans la barre
 * d'onglets du bas : en dessous de cette largeur, elles ne tiennent pas à côté du solde et du compte.
 */
export function SiteHeader() {
  const { status, accountsEnabled, state, username } = usePlayer();
  const pathname = usePath();
  const t = useT();
  const locale = useLocale();
  const berrys = formatNumber(state.berrys, locale);
  const guest = status === "guest" && accountsEnabled;

  return (
    <header className="border-b border-sea-700/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 lg:h-16 lg:gap-5 xl:gap-7">
        {/* Si tout ne tient pas malgré tout (solde à rallonge), c'est le nom du site qui est coupé, pas la page qui déborde */}
        <Link href="/" className="min-w-0 truncate font-display text-[22px] tracking-wide text-straw max-[375px]:text-[19px] lg:text-[26px]">
          {SITE_NAME}
        </Link>
        <nav aria-label={t("Navigation principale", "Main navigation")} className="hidden items-center gap-5 text-[15px] font-bold whitespace-nowrap text-mist lg:flex xl:gap-6">
          {LINKS.map((link) => {
            const active = link.active(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`border-b-2 py-1 transition-colors hover:text-foam ${active ? "border-straw text-foam" : "border-transparent"}`}
              >
                {link.label[locale]}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 text-sm font-bold lg:gap-3">
          <DailyPill compact={guest} />
          {/* Le solde n'est connu qu'une fois le navigateur prêt : on réserve sa place pour éviter un saut */}
          <Link
            href="/boutique"
            aria-label={t(`${berrys} Berrys, aller à la boutique`, `${berrys} Berries, go to the shop`)}
            className={`whitespace-nowrap hover:text-straw ${status === "loading" ? "invisible" : ""}`}
          >
            ฿ {berrys}
          </Link>
          {/* Le classement : une coupe. En invité sur téléphone, le bouton « Connexion » prend déjà toute la place */}
          <Link
            href="/classement"
            aria-label={t("Classement", "Leaderboard")}
            aria-current={under(pathname, "/classement") ? "page" : undefined}
            className={`size-9 items-center justify-center rounded-full border transition-colors ${
              under(pathname, "/classement") ? "border-straw text-straw" : "border-sea-600 text-mist hover:text-foam"
            } ${guest ? "hidden sm:flex" : "flex"}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-5">
              <path d="M6 2h8v1h3a1 1 0 0 1 1 1v1.5A3.5 3.5 0 0 1 14.6 9a4.8 4.8 0 0 1-3.6 3.4V15h2.5a1 1 0 0 1 0 2H6.5a1 1 0 0 1 0-2H9v-2.6A4.8 4.8 0 0 1 5.4 9 3.5 3.5 0 0 1 2 5.5V4a1 1 0 0 1 1-1h3V2Zm0 3H4v.5A1.5 1.5 0 0 0 5.2 7 7 7 0 0 1 6 5Zm8 0a7 7 0 0 1 .8 2A1.5 1.5 0 0 0 16 5.5V5h-2Z" />
            </svg>
          </Link>
          <NotificationBell />
          <LanguageSwitch className="hidden lg:inline-flex" />
          {status === "user" && (
            <Link
              href="/profil"
              aria-current={under(pathname, "/profil") ? "page" : undefined}
              className="hidden items-center gap-2 rounded-full border border-sea-600 px-3.5 py-1.5 hover:border-straw lg:flex"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
              <span className="max-w-24 truncate xl:max-w-40">{username}</span>
            </Link>
          )}
          {guest && (
            <Link href="/profil" className="rounded-full bg-straw px-3 py-1.5 whitespace-nowrap text-ink hover:bg-straw-dark lg:px-4">
              {t("Connexion", "Log in")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/** Barre d'onglets du téléphone et de la tablette, fixée en bas de l'écran. */
export function TabBar() {
  const pathname = usePath();
  const t = useT();
  const locale = useLocale();
  return (
    <nav
      aria-label={t("Rubriques", "Sections")}
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-sea-700 bg-sea-900 pb-[env(safe-area-inset-bottom)] text-[11px] font-bold text-mist lg:hidden"
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
            {tab.label[locale]}
          </Link>
        );
      })}
    </nav>
  );
}
