import type { Metadata } from "next";
import { meta } from "@/lib/data";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "À propos",
  description: `Ce qu'est ${SITE_NAME}, d'où viennent ses données et à qui appartient One Piece.`,
};

export default function About() {
  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 px-4 py-14">
      <h1 className="font-display text-5xl tracking-wide text-foam">À propos</h1>

      <section className="space-y-3 text-mist">
        <h2 className="font-display text-2xl tracking-wide text-straw">Un site de fans</h2>
        <p>
          {SITE_NAME} rassemble des mini-jeux autour de One Piece. Le site est gratuit, sans inscription obligatoire et
          sans but lucratif.
        </p>
        <p>
          One Piece est une œuvre d&apos;Eiichiro Oda, publiée par Shueisha et adaptée en anime par Toei Animation.{" "}
          {SITE_NAME} n&apos;est affilié à aucun d&apos;eux. Les noms, personnages et images de la série appartiennent
          à leurs ayants droit ; tout contenu sera retiré sur simple demande.
        </p>
      </section>

      <section className="space-y-3 text-mist">
        <h2 className="font-display text-2xl tracking-wide text-straw">Sources des données</h2>
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
          Les informations issues du One Piece Wiki (premières apparitions, primes, surnoms, affiliations) sont
          réutilisées selon les termes de la licence Creative Commons Attribution-ShareAlike.
        </p>
      </section>
    </article>
  );
}
