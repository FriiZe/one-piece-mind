import type { Metadata } from "next";
import Link from "@/components/Link";
import { GAMES } from "@/lib/games/catalog";
import { getLocale, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Page introuvable", "Page not found"),
    description: t(
      "Cette page n'existe pas, ou plus. Les mini-jeux One Piece, eux, sont toujours là.",
      "This page doesn't exist, or no longer does. The One Piece mini-games are still here, though.",
    ),
  };
}

/** Les jeux phares, pour ne pas laisser le visiteur sur une impasse. */
const SUGGESTIONS = GAMES.filter((game) => game.status === "live" && game.batch === "A");

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getT();
  const link = "font-bold text-straw underline underline-offset-4";
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-14">
      <div className="space-y-2">
        <p className="font-display text-2xl tracking-wide text-straw">{t("Erreur 404", "Error 404")}</p>
        <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">
          {t("Cette île n'est sur aucune carte", "This island isn't on any map")}
        </h1>
        <p className="text-mist">
          {t(
            <>
              La page que tu cherches n&apos;existe pas, ou plus. Le Log Pose pointe plutôt vers{" "}
              <Link href="/" className={link}>
                les jeux du jour
              </Link>{" "}
              ou{" "}
              <Link href="/jeux" className={link}>
                la liste de tous les jeux
              </Link>
              .
            </>,
            <>
              The page you&apos;re looking for doesn&apos;t exist, or no longer does. The Log Pose points to{" "}
              <Link href="/" className={link}>
                today&apos;s games
              </Link>{" "}
              or{" "}
              <Link href="/jeux" className={link}>
                the full list of games
              </Link>{" "}
              instead.
            </>,
          )}
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((game) => (
          <li key={game.slug}>
            <Link
              href={`/jeux/${game.slug}`}
              className="flex h-full flex-col gap-1 rounded-[14px] border border-sea-700 bg-sea-800 p-3.5 transition-colors hover:border-straw"
            >
              <span className="font-extrabold text-foam">{game.title[locale]}</span>
              <span className="text-[13px] text-mist">{game.pitch[locale]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
