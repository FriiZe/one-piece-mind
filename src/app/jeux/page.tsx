import type { Metadata } from "next";
import { GameCatalog } from "@/components/GameCatalog";
import { GAMES } from "@/lib/games/catalog";

const live = GAMES.filter((g) => g.status === "live").length;

export const metadata: Metadata = {
  title: "Tous les mini-jeux One Piece",
  description: `${live} mini-jeux One Piece gratuits à jouer dans le navigateur, sans inscription : OnePiecedle, primes, fruits du démon, équipages. D'autres arrivent.`,
  alternates: { canonical: "/jeux" },
};

export default function GamesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:py-8">
      <GameCatalog />
    </div>
  );
}
