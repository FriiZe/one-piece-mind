import type { Metadata } from "next";
import { DailyGames } from "@/components/DailyGames";
import { CATEGORY_TONES } from "@/components/GameBadge";
import { HomeStrip } from "@/components/HomeStrip";
import { JsonLd } from "@/components/JsonLd";
import Link from "@/components/Link";
import { formatNumber } from "@/games/engine/text";
import { meta } from "@/lib/data";
import { GAME_CATEGORIES, GAMES } from "@/lib/games/catalog";
import { localePath, translator, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { pageMetadata, SITE_NAME, SITE_URL } from "@/lib/site";

const live = GAMES.filter((g) => g.status === "live");

function texts(locale: Locale) {
  const t = translator(locale);
  return {
    title: t("Jeux et quiz One Piece gratuits, sans spoiler", "Free One Piece games and quizzes, spoiler-free"),
    description: t(
      `${live.length} mini-jeux et quiz One Piece gratuits, sans inscription : OnePiecedle du jour, primes, fruits du démon, hakis, équipages. Un mode sans spoiler pour ceux qui suivent l'anime.`,
      `${live.length} free One Piece mini-games and quizzes, no sign-up needed: the daily OnePiecedle, bounties, Devil Fruits, Haki, crews. A spoiler-free mode for anime watchers.`,
    ),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { title, description } = texts(locale);
  return {
    ...pageMetadata({ locale, title, description, path: "/" }),
    // L'accueil échappe au gabarit « %s — nom du site » des autres pages : les mots cherchés d'abord
    title: { absolute: `${title} — ${SITE_NAME}` },
  };
}

export default async function Home() {
  const locale = await getLocale();
  const t = translator(locale);
  const { description } = texts(locale);
  const categories = GAME_CATEGORIES.map((category) => ({
    ...category,
    games: live.filter((g) => g.category === category.id),
  })).filter((category) => category.games.length > 0);

  const episode = formatNumber(meta.latestEpisode, locale);
  const animeChapter = formatNumber(meta.animeCutoffChapter, locale);
  const mangaChapter = formatNumber(meta.latestChapter, locale);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 px-4 py-7 sm:py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          alternateName: "One Piece Mind",
          url: `${SITE_URL}${localePath(locale, "/")}`,
          description,
          inLanguage: locale,
        }}
      />
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">{t("Les mini-jeux One Piece", "One Piece mini-games")}</h1>
        <p className="text-mist">{t("Des parties courtes, gratuites, sans inscription.", "Quick games, free, no sign-up.")}</p>
      </div>

      <DailyGames />
      <HomeStrip />

      <section aria-labelledby="jeux-titre" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="jeux-titre" className="font-display text-[28px] tracking-wide text-foam">
            {t("Tous les jeux", "All games")}
          </h2>
          <Link href="/jeux" className="text-sm font-bold text-straw underline underline-offset-4">
            {t(`${live.length} jeux, ${categories.length} catégories`, `${live.length} games, ${categories.length} categories`)}
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <li key={category.id} className="flex flex-col gap-2 rounded-2xl border border-sea-700 bg-sea-800 p-4">
              <Link href={`/jeux#cat-${category.id}`} className="group flex items-center gap-2.5">
                <span aria-hidden="true" className={`size-3 rounded-full ${CATEGORY_TONES[category.id].dot}`} />
                <span className="font-extrabold text-foam group-hover:text-straw">{category.title[locale]}</span>
                <span className="ml-auto text-[13px] text-mist">
                  {t(
                    `${category.games.length} jeu${category.games.length > 1 ? "x" : ""}`,
                    `${category.games.length} game${category.games.length === 1 ? "" : "s"}`,
                  )}
                </span>
              </Link>
              {/* Un lien par jeu : chaque page de jeu est à un clic de l'accueil, pour les joueurs comme pour les moteurs */}
              <p className="text-sm leading-6 text-mist">
                {category.games.map((game, index) => (
                  <span key={game.slug}>
                    {index > 0 && " · "}
                    <Link href={`/jeux/${game.slug}`} className="underline-offset-4 hover:text-foam hover:underline">
                      {game.title[locale]}
                    </Link>
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="spoilers" className="rounded-2xl border border-sea-700 px-5 py-4">
        <h2 id="spoilers" className="font-extrabold text-foam">
          {t("Zéro spoiler, promis", "Zero spoilers, promise")}
        </h2>
        <p className="mt-1 text-sm text-mist">
          {t(
            `Avant ta première partie, tu indiques où tu en es : à jour sur l'anime (rien au-delà de l'épisode ${episode}, chapitre ${animeChapter}) ou à jour sur le manga (tout, jusqu'au chapitre ${mangaChapter}). Les jeux ne tirent alors que des personnages, des primes et des révélations que tu connais déjà.`,
            `Before your first game, you say how far along you are: caught up with the anime (nothing past episode ${episode}, chapter ${animeChapter}) or caught up with the manga (everything, up to chapter ${mangaChapter}). The games then only draw characters, bounties and reveals you already know.`,
          )}
        </p>
      </section>
    </div>
  );
}
