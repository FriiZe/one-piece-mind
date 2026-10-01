"use client";

import Link from "next/link";
import { formatNumber } from "@/games/engine/text";
import { useDailyKey, useIsClient } from "@/games/ui/storage";
import { BASE_BERRYS, DAILY_CHALLENGE, DAILY_CHALLENGE_BERRYS, DAILY_GAMES, DAILY_PASS, dailyGames } from "@/lib/economy";
import { getGame, isRewardless, type LiveSlug } from "@/lib/games/catalog";
import { usePlayer } from "@/lib/player/PlayerProvider";

type Entry = { key: string; href: string; title: string; pitch: string; berrys: number };

/**
 * Les jeux du jour : le défi du jour et les cinq jeux tirés pour la journée,
 * les seuls à rapporter des Berrys, une fois chacun. La sélection dépend de la
 * date : elle n'est calculée que dans le navigateur.
 */
export function DailyGames() {
  const { state, status } = usePlayer();
  const isClient = useIsClient();
  const today = useDailyKey();

  const entries: Entry[] = [
    {
      key: DAILY_CHALLENGE,
      href: "/jeux/onepiecedle",
      title: "Le défi du jour",
      pitch: "OnePiecedle : le personnage mystère, le même pour tous. Une recrue assurée.",
      berrys: DAILY_CHALLENGE_BERRYS,
    },
    ...dailyGames(today).map((slug) => {
      const game = getGame(slug)!;
      return { key: slug, href: `/jeux/${slug}`, title: game.title, pitch: game.pitch, berrys: BASE_BERRYS[slug] };
    }),
  ];
  const done = new Set(state.day.key === today ? state.day.done : []);
  const count = entries.filter((entry) => done.has(entry.key)).length;

  return (
    <section id="jeux-du-jour" aria-labelledby="jeux-du-jour-titre" className="scroll-mt-6 space-y-4 rounded-2xl border border-straw/40 bg-straw/5 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="jeux-du-jour-titre" className="font-display text-4xl tracking-wide text-straw">
            Les jeux du jour
          </h2>
          <p className="mt-1 max-w-2xl text-mist">
            Chaque jour, le défi du jour et {DAILY_GAMES} jeux tirés au hasard rapportent des Berrys et des recrues :{" "}
            <strong className="text-foam">une fois chacun</strong>, en marquant au moins {Math.round(DAILY_PASS * 100)} % des points.
            Les autres jeux se jouent pour le plaisir. Nouvelle sélection chaque nuit à minuit, heure de Paris.
          </p>
        </div>
        <p className={`font-display text-3xl tracking-wide text-foam ${isClient && status !== "loading" ? "" : "invisible"}`} aria-live="polite">
          {count} / {entries.length} <span className="font-sans text-base font-semibold text-mist">validés</span>
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isClient
          ? entries.map((entry) => {
              const validated = done.has(entry.key);
              return (
                <li key={entry.key}>
                  <Link
                    href={entry.href}
                    className={`flex h-full flex-col rounded-xl border-2 p-4 transition-colors ${
                      validated ? "border-emerald-400/70 bg-emerald-600/15" : "border-sea-600 bg-sea-800/80 hover:border-straw"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-bold text-foam">{entry.title}</span>
                      <span className={`shrink-0 text-sm font-bold ${validated ? "text-emerald-300" : "text-straw"}`}>
                        {validated ? "✓ Validé" : `${formatNumber(entry.berrys)} ฿`}
                      </span>
                    </span>
                    <span className="mt-1 text-sm text-mist">{entry.pitch}</span>
                  </Link>
                </li>
              );
            })
          : // Avant que le navigateur ne connaisse la date : des cases vides, à la taille des vraies
            Array.from({ length: DAILY_GAMES + 1 }, (_, i) => (
              <li key={i} className="h-24 rounded-xl border-2 border-sea-700 bg-sea-800/50" aria-hidden="true" />
            ))}
      </ul>
      <p className="text-sm text-mist">Montants pour un sans-faute en difficulté normale, avant les bonus de ton équipage.</p>
    </section>
  );
}

/** Sur la page d'un jeu : rapporte-t-il des Berrys aujourd'hui ? */
export function DailyBanner({ slug }: { slug: LiveSlug }) {
  const { state } = usePlayer();
  const isClient = useIsClient();
  const today = useDailyKey();
  if (isRewardless(slug)) return null;

  const done = state.day.key === today ? state.day.done : [];
  const challenge = slug === "onepiecedle";
  const featured = challenge || dailyGames(today).includes(slug);
  const validated = done.includes(challenge ? DAILY_CHALLENGE : slug);

  return (
    <p
      className={`min-h-12 rounded-xl border px-4 py-3 text-sm ${
        !isClient
          ? "border-transparent"
          : validated
            ? "border-emerald-400/60 bg-emerald-600/10 text-foam"
            : featured
              ? "border-straw/60 bg-straw/10 text-foam"
              : "border-sea-700 bg-sea-800/60 text-mist"
      }`}
    >
      {isClient &&
        (challenge ? (
          validated ? (
            "Défi du jour validé. La partie libre se joue pour le plaisir : elle ne rapporte pas de Berrys."
          ) : (
            <>
              <strong>Jeu du jour.</strong> Le défi du jour rapporte jusqu&apos;à {formatNumber(DAILY_CHALLENGE_BERRYS)} ฿ et une recrue, une
              fois par jour. La partie libre ne rapporte pas de Berrys.
            </>
          )
        ) : validated ? (
          "Jeu du jour déjà validé : il rapportera de nouveau des Berrys un autre jour. Tu peux rejouer pour le plaisir et les objectifs."
        ) : featured ? (
          <>
            <strong>Jeu du jour.</strong> Marque au moins {Math.round(DAILY_PASS * 100)} % des points pour gagner ses Berrys, une seule
            fois aujourd&apos;hui.
          </>
        ) : (
          <>
            Ce jeu n&apos;est pas dans la sélection du jour : il ne rapporte pas de Berrys aujourd&apos;hui, mais compte pour ses objectifs et
            les défis de la semaine.{" "}
            <Link href="/#jeux-du-jour" className="font-semibold text-straw underline underline-offset-4">
              Voir les jeux du jour
            </Link>
          </>
        ))}
    </p>
  );
}
