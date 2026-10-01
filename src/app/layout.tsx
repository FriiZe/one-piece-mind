import type { Metadata } from "next";
import { Bangers, Nunito } from "next/font/google";
import Link from "next/link";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

const display = Bangers({ variable: "--font-display", weight: "400", subsets: ["latin"] });
const body = Nunito({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, locale: "fr_FR", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-sea-700/60">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="font-display text-2xl tracking-wide text-straw">
              {SITE_NAME}
            </Link>
            <nav aria-label="Navigation principale" className="flex gap-5 text-sm font-semibold text-mist">
              <Link href="/jeux" className="hover:text-foam">
                Jeux
              </Link>
              <Link href="/a-propos" className="hover:text-foam">
                À propos
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-sea-700/60 text-sm text-mist">
          <div className="mx-auto w-full max-w-6xl space-y-2 px-4 py-8">
            <p>
              {SITE_NAME} est un site de fans, gratuit et sans but lucratif. One Piece est une œuvre d&apos;Eiichiro Oda,
              publiée par Shueisha et adaptée par Toei Animation ; ce site n&apos;est affilié à aucun d&apos;eux.
            </p>
            <p>
              <Link href="/a-propos" className="underline hover:text-foam">
                Sources des données et mentions
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
