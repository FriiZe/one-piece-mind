import type { Metadata } from "next";
import { DailyGames } from "@/components/DailyGames";
import { GameGrid } from "@/components/GameGrid";
import { GAMES } from "@/lib/games/catalog";

const live = GAMES.filter((g) => g.status === "live").length;

export const metadata: Metadata = {
  title: "Tous les mini-jeux One Piece",
  description: `${live} mini-jeux One Piece gratuits à jouer dans le navigateur, sans inscription : OnePiecedle, primes, fruits du démon, équipages. D'autres arrivent.`,
  alternates: { canonical: "/jeux" },
};

export default function GamesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="font-display text-5xl tracking-wide text-foam">Tous les jeux</h1>
      <p className="mt-2 max-w-2xl text-lg text-mist">
        {live} jeux sont disponibles, {GAMES.length - live} autres sont en préparation. Tous sont gratuits et se jouent
        sans inscription.
      </p>
      <div className="mt-8">
        <DailyGames />
      </div>
      <div className="mt-10">
        <GameGrid />
      </div>
    </div>
  );
}
