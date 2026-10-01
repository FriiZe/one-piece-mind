import type { Metadata } from "next";
import { Bangers, Nunito } from "next/font/google";
import Link from "next/link";
import { HeaderAccount, HeaderNav } from "@/components/HeaderNav";
import { PlayerProvider } from "@/lib/player/PlayerProvider";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
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
  openGraph: { siteName: SITE_NAME, locale: "fr_FR", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <PlayerProvider>
          <header className="border-b border-sea-700/60">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4">
              <Link href="/" className="font-display text-2xl tracking-wide text-straw">
                {SITE_NAME}
              </Link>
              <HeaderNav />
              <HeaderAccount />
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-sea-700/60 text-sm text-mist">
            <div className="mx-auto w-full max-w-6xl space-y-2 px-4 py-8">
              {/* Toutes les rubriques, y compris celles que l'en-tête masque sur téléphone */}
              <nav aria-label="Rubriques" className="flex flex-wrap gap-x-5 gap-y-1 font-semibold">
                {[
                  { href: "/jeux", label: "Jeux" },
                  { href: "/multi", label: "Multijoueur" },
                  { href: "/quiz", label: "Quiz de la commu" },
                  { href: "/defis", label: "Défis" },
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
        </PlayerProvider>
      </body>
    </html>
  );
}
