import type { Metadata } from "next";
import { meta } from "@/lib/data";
import { translator } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import { pageMetadata, SITE_NAME } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = translator(locale);
  return pageMetadata({
    locale,
    title: t("À propos", "About"),
    description: t(
      `Ce qu'est ${SITE_NAME}, d'où viennent ses données et à qui appartient One Piece.`,
      `What ${SITE_NAME} is, where its data comes from and who owns One Piece.`,
    ),
    path: "/a-propos",
  });
}

export default async function About() {
  const t = await getT();
  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 px-4 py-14">
      <h1 className="font-display text-5xl tracking-wide text-foam">{t("À propos", "About")}</h1>

      <section className="space-y-3 text-mist">
        <h2 className="font-display text-2xl tracking-wide text-straw">{t("Un site de fans", "A fan site")}</h2>
        <p>
          {t(
            `${SITE_NAME} rassemble des mini-jeux autour de One Piece. Le site est gratuit, sans inscription obligatoire et sans but lucratif.`,
            `${SITE_NAME} brings together mini-games about One Piece. The site is free, requires no sign-up and is non-profit.`,
          )}
        </p>
        <p>
          {t(
            `One Piece est une œuvre d'Eiichiro Oda, publiée par Shueisha et adaptée en anime par Toei Animation. ${SITE_NAME} n'est affilié à aucun d'eux. Les noms, personnages et images de la série appartiennent à leurs ayants droit ; tout contenu sera retiré sur simple demande.`,
            `One Piece is a work by Eiichiro Oda, published by Shueisha and adapted into an anime by Toei Animation. ${SITE_NAME} is not affiliated with any of them. The names, characters and images of the series belong to their rights holders; any content will be removed on request.`,
          )}
        </p>
      </section>

      <section className="space-y-3 text-mist">
        <h2 className="font-display text-2xl tracking-wide text-straw">{t("Sources des données", "Data sources")}</h2>
        <ul className="list-disc space-y-2 pl-5">
          {meta.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} rel="noopener" className="font-semibold text-foam underline">
                {source.name}
              </a>{" "}
              ({source.license})
            </li>
          ))}
        </ul>
        <p>
          {t(
            "Les informations issues du One Piece Wiki (premières apparitions, primes, surnoms, affiliations) sont réutilisées selon les termes de la licence Creative Commons Attribution-ShareAlike.",
            "Information taken from the One Piece Wiki (first appearances, bounties, epithets, affiliations) is reused under the terms of the Creative Commons Attribution-ShareAlike license.",
          )}
        </p>
      </section>
    </article>
  );
}
