import type { Metadata } from "next";
import { Bangers, Nunito } from "next/font/google";
import Link from "next/link";
import { SiteHeader, TabBar } from "@/components/HeaderNav";
import { PlayerProvider } from "@/lib/player/PlayerProvider";
import { OPEN_GRAPH, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

const display = Bangers({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});
const body = Nunito({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: OPEN_GRAPH,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable} h-full antialiased`}>
      {/* Sur téléphone, la barre d'onglets est fixée en bas : on lui réserve sa hauteur */}
      <body className="flex min-h-full flex-col pb-[calc(68px+env(safe-area-inset-bottom))] font-sans md:pb-0">
        <PlayerProvider>
          <SiteHeader />

          <main className="flex-1">{children}</main>

          <footer className="border-t border-sea-700/60 text-sm text-mist">
            <div className="mx-auto w-full max-w-6xl space-y-2 px-4 py-8">
              {/* Toutes les rubriques, y compris celles que la navigation ne cite pas */}
              <nav aria-label="Rubriques" className="flex flex-wrap gap-x-5 gap-y-1 font-semibold">
                {[
                  { href: "/jeux", label: "Jeux" },
                  { href: "/multi", label: "Multijoueur" },
                  { href: "/quiz", label: "Quiz de la commu" },
                  { href: "/defis", label: "Défis" },
                  { href: "/navire", label: "Mon navire" },
                  { href: "/collection", label: "Collection" },
                  { href: "/boutique", label: "Boutique" },
                  { href: "/echanges", label: "Échanges" },
                  { href: "/profil", label: "Mon compte" },
                ].map((link) => (
                  <Link key={link.href} href={link.href} className="hover:text-foam">
                    {link.label}
                  </Link>
                ))}
              </nav>
              <p>
                {SITE_NAME} est un site de fans, gratuit et sans but lucratif. One Piece est une œuvre d&apos;Eiichiro
                Oda, publiée par Shueisha et adaptée par Toei Animation ; ce site n&apos;est affilié à aucun d&apos;eux.
              </p>
              <p>
                <Link href="/a-propos" className="underline hover:text-foam">
                  Sources des données et mentions
                </Link>
              </p>
            </div>
          </footer>
          <TabBar />
        </PlayerProvider>
      </body>
    </html>
  );
}
