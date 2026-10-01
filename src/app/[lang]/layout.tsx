import type { Metadata } from "next";
import { Bangers, Nunito } from "next/font/google";
import { notFound } from "next/navigation";
import { SiteHeader, TabBar } from "@/components/HeaderNav";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import Link from "@/components/Link";
import { isLocale, LOCALES, translator } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/i18n/client";
import { PlayerProvider } from "@/lib/player/PlayerProvider";
import { openGraph, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "../globals.css";

const display = Bangers({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});
const body = Nunito({ variable: "--font-body", subsets: ["latin"] });

// Une page par langue du site : toute autre valeur de `[lang]` renvoie une 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${SITE_NAME} — ${SITE_TAGLINE[lang]}`,
      template: `%s — ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION[lang],
    openGraph: openGraph(lang),
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = translator(lang);

  return (
    <html lang={lang} className={`${display.variable} ${body.variable} h-full antialiased`}>
      {/* Sur téléphone, la barre d'onglets est fixée en bas : on lui réserve sa hauteur */}
      <body className="flex min-h-full flex-col pb-[calc(68px+env(safe-area-inset-bottom))] font-sans md:pb-0">
        <LocaleProvider locale={lang}>
          <PlayerProvider>
            <SiteHeader />

            <main className="flex-1">{children}</main>

            <footer className="border-t border-sea-700/60 text-sm text-mist">
              <div className="mx-auto w-full max-w-6xl space-y-2 px-4 py-8">
                {/* Toutes les rubriques, y compris celles que la navigation ne cite pas */}
                <nav aria-label={t("Rubriques", "Sections")} className="flex flex-wrap gap-x-5 gap-y-1 font-semibold">
                  {[
                    { href: "/jeux", label: t("Jeux", "Games") },
                    { href: "/multi", label: t("Multijoueur", "Multiplayer") },
                    { href: "/quiz", label: t("Quiz de la commu", "Community quizzes") },
                    { href: "/defis", label: t("Défis", "Challenges") },
                    { href: "/navire", label: t("Mon navire", "My ship") },
                    { href: "/collection", label: t("Collection", "Collection") },
                    { href: "/boutique", label: t("Boutique", "Shop") },
                    { href: "/echanges", label: t("Échanges", "Trades") },
                    { href: "/profil", label: t("Mon compte", "My account") },
                  ].map((link) => (
                    <Link key={link.href} href={link.href} className="hover:text-foam">
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <p>
                  {t(
                    `${SITE_NAME} est un site de fans, gratuit et sans but lucratif. One Piece est une œuvre d'Eiichiro Oda, publiée par Shueisha et adaptée par Toei Animation ; ce site n'est affilié à aucun d'eux.`,
                    `${SITE_NAME} is a free, non-profit fan site. One Piece is a work by Eiichiro Oda, published by Shueisha and adapted by Toei Animation; this site is not affiliated with any of them.`,
                  )}
                </p>
                <p className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
                  <Link href="/a-propos" className="underline hover:text-foam">
                    {t("Sources des données et mentions", "Data sources and credits")}
                  </Link>
                  <LanguageSwitch />
                </p>
              </div>
            </footer>
            <TabBar />
          </PlayerProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
