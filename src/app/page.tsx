import Link from "next/link";
import { DailyGames } from "@/components/DailyGames";
import { GameGrid } from "@/components/GameGrid";
import { JsonLd } from "@/components/JsonLd";
import { characters, fruits, meta } from "@/lib/data";
import { GAMES } from "@/lib/games/catalog";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { isPlayableCharacter } from "@/lib/spoilers";

const number = new Intl.NumberFormat("fr-FR");

export default function Home() {
  const live = GAMES.filter((g) => g.status === "live").length;
  const stats = [
    { value: live, label: "jeux disponibles" },
    { value: characters.filter((c) => isPlayableCharacter(c, "manga")).length, label: "personnages" },
    { value: fruits.length, label: "fruits du démon" },
    { value: meta.latestChapter, label: "chapitres couverts" },
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL,
          description: SITE_DESCRIPTION,
          inLanguage: "fr",
        }}
      />
      <section className="mx-auto w-full max-w-6xl px-4 pt-14 pb-12">
        <p className="mb-4 inline-block rounded-full border border-straw/40 bg-straw/10 px-3 py-1 text-sm font-semibold text-straw">
          {live} jeux disponibles, {GAMES.length - live} en préparation
        </p>
        <h1 className="max-w-3xl font-display text-5xl leading-none tracking-wide text-foam sm:text-7xl">
          Tous les mini-jeux One Piece, <span className="text-straw">au même endroit</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-mist">
          Silhouettes, primes, fruits du démon, défis quotidiens : des parties courtes, gratuites et sans inscription,
          jouables sur ordinateur comme sur téléphone.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="#jeux-du-jour"
            className="rounded-lg bg-straw px-5 py-3 font-bold text-ink transition-colors hover:bg-straw-dark"
          >
            Les jeux du jour
          </Link>
          <Link
            href="/jeux"
            className="rounded-lg border border-sea-600 bg-sea-700 px-5 py-3 font-bold text-foam transition-colors hover:bg-sea-600"
          >
            Tous les jeux
          </Link>
          {[
            { href: "/multi", label: "Jouer à plusieurs" },
            { href: "/quiz", label: "Quiz de la commu" },
            { href: "/defis", label: "Défis de la semaine" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-sea-600 px-5 py-3 font-bold text-mist transition-colors hover:border-straw hover:text-foam"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse rounded-xl border border-sea-700 bg-sea-800/70 px-4 py-4">
              <dt className="text-sm text-mist">{stat.label}</dt>
              <dd className="font-display text-4xl tracking-wide text-straw">{number.format(stat.value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 pb-12">
        <DailyGames />
      </div>

      <section aria-labelledby="spoilers" className="mx-auto w-full max-w-6xl px-4 pb-12">
        <div className="rounded-2xl bg-parchment p-6 text-ink sm:p-8">
          <h2 id="spoilers" className="font-display text-3xl tracking-wide">
            Zéro spoiler, promis
          </h2>
          <p className="mt-2 max-w-2xl">
            Avant chaque partie, tu indiques où tu en es. Les jeux ne tirent alors que des personnages, des primes et
            des révélations que tu connais déjà.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-ink/15 bg-white/50 p-4">
              <h3 className="font-bold">Je suis à jour sur l&apos;anime</h3>
              <p className="mt-1 text-sm">
                Rien au-delà de l&apos;épisode {number.format(meta.latestEpisode)} (chapitre{" "}
                {number.format(meta.animeCutoffChapter)}).
              </p>
            </div>
            <div className="rounded-xl border-2 border-ink/15 bg-white/50 p-4">
              <h3 className="font-bold">Je suis à jour sur le manga</h3>
              <p className="mt-1 text-sm">Tout, jusqu&apos;au chapitre {number.format(meta.latestChapter)}.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="jeux" aria-labelledby="jeux-titre" className="mx-auto w-full max-w-6xl scroll-mt-6 px-4 pb-16">
        <h2 id="jeux-titre" className="font-display text-4xl tracking-wide text-foam">
          Les jeux
        </h2>
        <div className="mt-6">
          <GameGrid />
        </div>
      </section>
    </>
  );
}
