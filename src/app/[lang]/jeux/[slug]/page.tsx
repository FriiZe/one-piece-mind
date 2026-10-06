import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DailyChip, OtherDailyGames } from "@/components/DailyGames";
import { GameObjectives, GameRecord } from "@/components/GameObjectives";
import { DailyLeaderboard, GameLeaderboard } from "@/components/Leaderboards";
import { JsonLd } from "@/components/JsonLd";
import Link from "@/components/Link";
import { GAME_CONTENT } from "@/games/content";
import { GameRunner } from "@/games/ui/GameRunner";
import { GAME_CATEGORIES, GAMES, getGame, isLiveSlug, isRewardless, LIVE_SLUGS } from "@/lib/games/catalog";
import { localePath, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { pageMetadata, SITE_NAME, SITE_URL } from "@/lib/site";

// Seuls les jeux en ligne ont une page : toute autre adresse renvoie une 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return LIVE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/jeux/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isLiveSlug(slug)) return {};
  const locale = await getLocale();
  const content = GAME_CONTENT[locale][slug];
  return pageMetadata({ locale, title: content.metaTitle, description: content.metaDescription, path: `/jeux/${slug}` });
}

export default async function GamePage({ params }: PageProps<"/[lang]/jeux/[slug]">) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game || !isLiveSlug(slug)) notFound();

  const locale = await getLocale();
  const t = translator(locale);
  const title = game.title[locale];
  const content = GAME_CONTENT[locale][slug];
  const category = GAME_CATEGORIES.find((c) => c.id === game.category)!;
  const siblings = GAMES.filter((g) => g.status === "live" && g.category === game.category && g.slug !== slug);
  const rewardless = isRewardless(slug);
  const url = `${SITE_URL}${localePath(locale, `/jeux/${slug}`)}`;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 px-4 py-7 sm:py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "VideoGame",
              name: title,
              description: content.metaDescription,
              url,
              image: `${url}/opengraph-image`,
              inLanguage: locale,
              genre: "Quiz",
              gamePlatform: t("Navigateur web", "Web browser"),
              applicationCategory: "Game",
              operatingSystem: t("Tous", "Any"),
              isAccessibleForFree: true,
              offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
              publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
            },
            {
              "@type": "FAQPage",
              mainEntity: content.faq.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: { "@type": "Answer", text: item.answer },
              })),
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: t("Accueil", "Home"), item: `${SITE_URL}${localePath(locale, "/")}` },
                { "@type": "ListItem", position: 2, name: t("Jeux", "Games"), item: `${SITE_URL}${localePath(locale, "/jeux")}` },
                { "@type": "ListItem", position: 3, name: title, item: url },
              ],
            },
          ],
        }}
      />

      <header className="space-y-3">
        <nav aria-label={t("Fil d'Ariane", "Breadcrumb")} className="text-sm text-mist">
          <Link href="/jeux" className="underline underline-offset-4 hover:text-foam">
            {t("Jeux", "Games")}
          </Link>{" "}
          /{" "}
          <Link href={`/jeux#cat-${category.id}`} className="underline underline-offset-4 hover:text-foam">
            {category.title[locale]}
          </Link>{" "}
          / <span aria-current="page">{title}</span>
        </nav>
        <div>
          <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">{title}</h1>
          <p className="mt-1 max-w-3xl text-mist">{content.intro}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <DailyChip slug={slug} />
          <GameRecord slug={slug} />
        </div>
      </header>

      <section aria-label={t("Le jeu", "The game")}>
        <GameRunner slug={slug} />
      </section>

      <div className={`grid gap-5 ${rewardless ? "" : "lg:grid-cols-2"}`}>
        {!rewardless && <GameObjectives slug={slug} />}
        <section aria-labelledby="comment-jouer" className="space-y-3 rounded-2xl border border-sea-700 p-5">
          <h2 id="comment-jouer" className="text-lg font-extrabold text-foam">
            {t("Comment jouer", "How to play")}
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-mist marker:font-bold marker:text-straw">
            {content.howTo.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <a href="#questions" className="inline-block text-sm font-bold text-straw underline underline-offset-4">
            {t("Questions fréquentes", "Frequently asked questions")}
          </a>
        </section>
      </div>

      {/* OnePiecedle a son défi du jour, classé à part : les parties libres se comptent par niveau */}
      {slug === "onepiecedle" && <DailyLeaderboard />}
      {!rewardless && (
        <GameLeaderboard slug={slug} title={slug === "onepiecedle" ? t("Classement des parties libres", "Free play leaderboard") : undefined} />
      )}

      <OtherDailyGames slug={slug} />

      {siblings.length > 0 && (
        <p className="text-sm text-mist">
          {t("Dans la même catégorie :", "In the same category:")}{" "}
          {siblings.map((other, index) => (
            <span key={other.slug}>
              {index > 0 && " · "}
              <Link href={`/jeux/${other.slug}`} className="font-bold text-foam underline underline-offset-4 hover:text-straw">
                {other.title[locale]}
              </Link>
            </span>
          ))}
        </p>
      )}

      <section aria-labelledby="questions" className="scroll-mt-6 space-y-3">
        <h2 id="questions" className="font-display text-[28px] tracking-wide text-foam">
          {t("Questions fréquentes", "Frequently asked questions")}
        </h2>
        <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {content.faq.map((item) => (
            <div key={item.question}>
              <dt className="font-bold text-foam">{item.question}</dt>
              <dd className="mt-1 text-sm text-mist">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
