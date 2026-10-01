import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DailyBanner } from "@/components/DailyGames";
import { GameObjectives } from "@/components/GameObjectives";
import { JsonLd } from "@/components/JsonLd";
import { GAME_CONTENT } from "@/games/content";
import { GameRunner } from "@/games/ui/GameRunner";
import { GAMES, getGame, isLiveSlug, isRewardless, LIVE_SLUGS } from "@/lib/games/catalog";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Seuls les jeux en ligne ont une page : toute autre adresse renvoie une 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return LIVE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/jeux/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isLiveSlug(slug)) return {};
  const content = GAME_CONTENT[slug];
  return {
    title: content.metaTitle,
    description: content.metaDescription,
    alternates: { canonical: `/jeux/${slug}` },
    openGraph: { title: content.metaTitle, description: content.metaDescription, url: `/jeux/${slug}` },
  };
}

export default async function GamePage({ params }: PageProps<"/jeux/[slug]">) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game || !isLiveSlug(slug)) notFound();

  const content = GAME_CONTENT[slug];
  const others = GAMES.filter((g) => g.status === "live" && g.slug !== slug).slice(0, 6);
  const url = `${SITE_URL}/jeux/${slug}`;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 px-4 py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "VideoGame",
              name: game.title,
              description: content.metaDescription,
              url,
              inLanguage: "fr",
              genre: "Quiz",
              gamePlatform: "Navigateur web",
              applicationCategory: "Game",
              operatingSystem: "Tous",
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
                { "@type": "ListItem", position: 1, name: "Jeux", item: `${SITE_URL}/jeux` },
                { "@type": "ListItem", position: 2, name: game.title, item: url },
              ],
            },
          ],
        }}
      />

      <header>
        <nav aria-label="Fil d'Ariane" className="text-sm text-mist">
          <Link href="/jeux" className="underline underline-offset-4 hover:text-foam">
            Jeux
          </Link>{" "}
          / <span aria-current="page">{game.title}</span>
        </nav>
        <h1 className="mt-2 font-display text-5xl tracking-wide text-foam">{game.title}</h1>
        <p className="mt-2 max-w-2xl text-lg text-mist">{content.intro}</p>
      </header>

      <section aria-label="Le jeu" className="space-y-4">
        <DailyBanner slug={slug} />
        <GameRunner slug={slug} />
      </section>

      {!isRewardless(slug) && <GameObjectives slug={slug} />}

      <section aria-labelledby="comment-jouer" className="space-y-3">
        <h2 id="comment-jouer" className="font-display text-3xl tracking-wide text-straw">
          Comment jouer
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-mist marker:font-bold marker:text-straw">
          {content.howTo.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="questions" className="space-y-3">
        <h2 id="questions" className="font-display text-3xl tracking-wide text-straw">
          Questions fréquentes
        </h2>
        <dl className="space-y-4">
          {content.faq.map((item) => (
            <div key={item.question}>
              <dt className="font-bold text-foam">{item.question}</dt>
              <dd className="mt-1 text-mist">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="autres-jeux" className="space-y-3">
        <h2 id="autres-jeux" className="font-display text-3xl tracking-wide text-straw">
          D&apos;autres jeux
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((other) => (
            <li key={other.slug}>
              <Link
                href={`/jeux/${other.slug}`}
                className="block h-full rounded-xl border border-sea-600 bg-sea-800/70 p-4 transition-colors hover:border-straw"
              >
                <span className="block font-bold text-foam">{other.title}</span>
                <span className="mt-1 block text-sm text-mist">{other.pitch}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
