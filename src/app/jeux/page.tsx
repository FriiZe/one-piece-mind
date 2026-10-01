import type { Metadata } from "next";
import { GameCatalog } from "@/components/GameCatalog";
import { JsonLd } from "@/components/JsonLd";
import { GAMES } from "@/lib/games/catalog";
import { pageMetadata, SITE_URL } from "@/lib/site";

const live = GAMES.filter((g) => g.status === "live");
const title = "Tous les mini-jeux One Piece";
const description = `${live.length} mini-jeux One Piece gratuits à jouer dans le navigateur, sans inscription : OnePiecedle, primes, fruits du démon, équipages. D'autres arrivent.`;

export const metadata: Metadata = pageMetadata({ title, description, path: "/jeux" });

export default function GamesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description,
          url: `${SITE_URL}/jeux`,
          inLanguage: "fr",
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: live.length,
            itemListElement: live.map((game, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: game.title,
              url: `${SITE_URL}/jeux/${game.slug}`,
            })),
          },
        }}
      />
      <GameCatalog />
    </div>
  );
}
