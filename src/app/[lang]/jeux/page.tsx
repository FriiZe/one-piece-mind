import type { Metadata } from "next";
import { GameCatalog } from "@/components/GameCatalog";
import { JsonLd } from "@/components/JsonLd";
import { GAMES } from "@/lib/games/catalog";
import { localePath, translator, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { pageMetadata, SITE_URL } from "@/lib/site";

const live = GAMES.filter((g) => g.status === "live");

function texts(locale: Locale) {
  const t = translator(locale);
  return {
    title: t("Tous les mini-jeux One Piece", "All One Piece mini-games"),
    description: t(
      `${live.length} mini-jeux One Piece gratuits à jouer dans le navigateur, sans inscription : OnePiecedle, primes, fruits du démon, équipages. D'autres arrivent.`,
      `${live.length} free One Piece mini-games to play in your browser, no sign-up needed: OnePiecedle, bounties, Devil Fruits, crews. More on the way.`,
    ),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({ locale, ...texts(locale), path: "/jeux" });
}

export default async function GamesPage() {
  const locale = await getLocale();
  const { title, description } = texts(locale);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description,
          url: `${SITE_URL}${localePath(locale, "/jeux")}`,
          inLanguage: locale,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: live.length,
            itemListElement: live.map((game, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: game.title[locale],
              url: `${SITE_URL}${localePath(locale, `/jeux/${game.slug}`)}`,
            })),
          },
        }}
      />
      <GameCatalog />
    </div>
  );
}
