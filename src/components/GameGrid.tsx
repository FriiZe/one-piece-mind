import Link from "next/link";
import { GAME_CATEGORIES, GAMES, type Game } from "@/lib/games/catalog";

function GameCard({ game }: { game: Game }) {
  const live = game.status === "live";
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-bold text-foam">{game.title}</h4>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            live ? "bg-straw text-ink" : "bg-sea-700 text-mist"
          }`}
        >
          {live ? "Jouer" : "Bientôt"}
        </span>
      </div>
      <p className="mt-1 text-sm text-mist">{game.pitch}</p>
    </>
  );

  if (!live) return <li className="rounded-xl border border-sea-700 bg-sea-800/40 p-4 opacity-80">{body}</li>;
  return (
    <li>
      <Link
        href={`/jeux/${game.slug}`}
        className="block h-full rounded-xl border border-sea-600 bg-sea-800/70 p-4 transition-colors hover:border-straw"
      >
        {body}
      </Link>
    </li>
  );
}

/** Le catalogue par catégorie ; dans chacune, les jeux disponibles d'abord. */
export function GameGrid() {
  return (
    <div className="space-y-10">
      {GAME_CATEGORIES.map((category) => {
        const games = GAMES.filter((g) => g.category === category.id).sort(
          (a, b) => Number(b.status === "live") - Number(a.status === "live"),
        );
        return (
          <div key={category.id}>
            <h3 className="font-display text-2xl tracking-wide text-straw">
              {category.title} <span className="font-sans text-base font-semibold text-mist">· {games.length}</span>
            </h3>
            <p className="mt-1 text-mist">{category.description}</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((game) => (
                <GameCard key={game.slug} game={game} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
