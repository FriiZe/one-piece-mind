import type { Metadata } from "next";
import Link from "next/link";
import { GAMES } from "@/lib/games/catalog";

export const metadata: Metadata = {
  title: "Page introuvable",
  description: "Cette page n'existe pas, ou plus. Les mini-jeux One Piece, eux, sont toujours là.",
};

/** Les jeux phares, pour ne pas laisser le visiteur sur une impasse. */
const SUGGESTIONS = GAMES.filter((game) => game.status === "live" && game.batch === "A");

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-14">
      <div className="space-y-2">
        <p className="font-display text-2xl tracking-wide text-straw">Erreur 404</p>
        <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">Cette île n&apos;est sur aucune carte</h1>
        <p className="text-mist">
          La page que tu cherches n&apos;existe pas, ou plus. Le Log Pose pointe plutôt vers{" "}
          <Link href="/" className="font-bold text-straw underline underline-offset-4">
            les jeux du jour
          </Link>{" "}
          ou{" "}
          <Link href="/jeux" className="font-bold text-straw underline underline-offset-4">
            la liste de tous les jeux
          </Link>
          .
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((game) => (
          <li key={game.slug}>
            <Link
              href={`/jeux/${game.slug}`}
              className="flex h-full flex-col gap-1 rounded-[14px] border border-sea-700 bg-sea-800 p-3.5 transition-colors hover:border-straw"
            >
              <span className="font-extrabold text-foam">{game.title}</span>
              <span className="text-[13px] text-mist">{game.pitch}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
