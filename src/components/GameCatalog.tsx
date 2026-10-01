"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { formatNumber } from "@/games/engine/text";
import { GAME_CATEGORIES, GAMES, type Game, type GameCategoryId } from "@/lib/games/catalog";
import { useLocale, useT } from "@/lib/i18n/client";
import { useDaily, useWeekly } from "@/lib/player/useDaily";
import { DailyStrip } from "./DailyGames";
import { CATEGORY_TONES, GameBadge } from "./GameBadge";

const LIVE = GAMES.filter((game) => game.status === "live");
const SOON = GAMES.filter((game) => game.status !== "live");

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type Status = { tone: "done" | "daily" | "weekly"; text: string };

function GameCard({ game, status }: { game: Game; status?: Status }) {
  const locale = useLocale();
  return (
    <li>
      <Link
        href={`/jeux/${game.slug}`}
        className={`flex h-full flex-col gap-2 rounded-[14px] border p-3.5 sm:min-h-32 transition-colors hover:border-straw ${
          status?.tone === "done"
            ? "border-emerald-400/40 bg-emerald-600/15"
            : status?.tone === "daily"
              ? "border-straw/50 bg-sea-800"
              : "border-sea-700 bg-sea-800"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <GameBadge title={game.title[locale]} category={game.category} className="size-[34px] text-lg" />
          <span className="font-extrabold text-foam">{game.title[locale]}</span>
        </span>
        <span className="text-[13px] text-mist">{game.pitch[locale]}</span>
        {status && (
          <span
            className={`mt-auto text-[13px] font-extrabold ${
              status.tone === "done" ? "text-emerald-300" : status.tone === "daily" ? "text-straw" : "text-foam"
            }`}
          >
            {status.text}
          </span>
        )}
      </Link>
    </li>
  );
}

/** Le catalogue : filtrable par catégorie et par nom, avec ce que chaque jeu rapporte aujourd'hui. */
export function GameCatalog() {
  const [category, setCategory] = useState<GameCategoryId | null>(null);
  const [query, setQuery] = useState("");
  const daily = useDaily();
  const weekly = useWeekly();
  const t = useT();
  const locale = useLocale();

  const statusOf = (game: Game): Status | undefined => {
    if (!daily.ready) return undefined;
    const entry = daily.entries.find((e) => e.slug === game.slug);
    if (entry?.done) {
      const text = entry.challenge ? t("Défi du jour validé", "Daily challenge cleared") : t("Jeu du jour validé", "Daily game cleared");
      return { tone: "done", text };
    }
    if (entry) {
      const kind = entry.challenge ? t("Défi du jour", "Daily challenge") : t("Jeu du jour", "Daily game");
      return { tone: "daily", text: `${kind} · ${formatNumber(entry.berrys, locale)} ฿` };
    }
    const challenge = weekly.challenges.find((c) => c.slug === game.slug && !c.done);
    if (challenge) {
      const progress = `${formatNumber(challenge.value, locale)} / ${formatNumber(challenge.target, locale)}`;
      return { tone: "weekly", text: t(`Défi de la semaine : ${progress}`, `Weekly challenge: ${progress}`) };
    }
    return undefined;
  };

  const needle = fold(query.trim());
  const matches = (game: Game) => (category === null || game.category === category) && (!needle || fold(game.title[locale]).includes(needle));
  const sections = GAME_CATEGORIES.map((c) => ({ ...c, games: LIVE.filter((game) => game.category === c.id && matches(game)) })).filter(
    (section) => section.games.length > 0,
  );
  const soon = SOON.filter(matches);
  const chip = (active: boolean) =>
    `min-h-11 cursor-pointer rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors ${
      active ? "bg-straw text-ink" : "border border-sea-700 bg-sea-800 text-mist hover:text-foam"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">{t("Tous les jeux", "All games")}</h1>
        <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto">
          <label className="relative block w-full sm:w-60">
            <span className="sr-only">{t("Chercher un jeu", "Search for a game")}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-mist"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Chercher un jeu", "Search for a game")}
              className="h-12 w-full rounded-xl border border-sea-600 bg-sea-900 pr-3 pl-10 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none"
            />
          </label>
          <DailyStrip />
        </div>
      </div>

      <div
        role="group"
        aria-label={t("Filtrer par catégorie", "Filter by category")}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)} className={chip(category === null)}>
          {t("Tous", "All")} · {LIVE.length}
        </button>
        {GAME_CATEGORIES.map((c) => {
          const count = LIVE.filter((game) => game.category === c.id).length;
          if (count === 0) return null;
          return (
            <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id)} className={chip(category === c.id)}>
              {c.title[locale]} · {count}
            </button>
          );
        })}
      </div>

      {sections.map((section) => (
        <section key={section.id} id={`cat-${section.id}`} aria-labelledby={`titre-${section.id}`} className="scroll-mt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span aria-hidden="true" className={`size-3.5 rounded-full ${CATEGORY_TONES[section.id].dot}`} />
            <h2 id={`titre-${section.id}`} className="text-xl font-extrabold text-foam">
              {section.title[locale]}
            </h2>
            <p className="text-sm text-mist">{section.description[locale]}</p>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {section.games.map((game) => (
              <GameCard key={game.slug} game={game} status={statusOf(game)} />
            ))}
          </ul>
        </section>
      ))}

      {sections.length === 0 && (
        <p className="rounded-2xl border border-sea-700 p-6 text-mist" aria-live="polite">
          {t(`Aucun jeu disponible ne correspond à « ${query.trim()} ».`, `No available game matches “${query.trim()}”.`)}
        </p>
      )}

      {soon.length > 0 && (
        <section aria-labelledby="bientot" className="space-y-1.5 rounded-2xl border border-dashed border-sea-600 px-5 py-4">
          <h2 id="bientot" className="font-extrabold text-foam">
            {t(
              `En préparation · ${soon.length} jeu${soon.length > 1 ? "x" : ""}`,
              `Coming soon · ${soon.length} ${soon.length === 1 ? "game" : "games"}`,
            )}
          </h2>
          <p className="text-sm text-mist">{soon.map((game) => game.title[locale]).join(" · ")}</p>
        </section>
      )}
    </div>
  );
}
