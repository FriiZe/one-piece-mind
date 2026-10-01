"use client";

import Link from "@/components/Link";
import { formatNumber } from "@/games/engine/text";
import { useUntilMidnight } from "@/games/ui/storage";
import { DAILY_GAMES, DAILY_PASS, OFF_DAY_RECRUIT_CHANCE } from "@/lib/economy";
import { isRewardless, type LiveSlug } from "@/lib/games/catalog";
import type { Locale } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { useDaily, type DailyEntry } from "@/lib/player/useDaily";
import { CheckIcon, GameBadge, Segments } from "./GameBadge";

const pass = (locale: Locale) => `${Math.round(DAILY_PASS * 100)}${locale === "en" ? "%" : " %"}`;

function Validated() {
  const t = useT();
  return (
    <span className="flex shrink-0 items-center gap-1 text-sm font-extrabold text-emerald-300">
      <CheckIcon className="size-3.5" />
      {t("Validé", "Cleared")}
    </span>
  );
}

function DailyRow({ entry }: { entry: DailyEntry }) {
  const locale = useLocale();
  return (
    <li>
      <Link
        href={entry.href}
        className={`flex min-h-[60px] items-center gap-3.5 rounded-xl border px-3.5 py-2 transition-colors ${
          entry.done ? "border-emerald-400/40 bg-emerald-600/15" : "border-sea-600 bg-sea-800 hover:border-straw"
        }`}
      >
        <GameBadge title={entry.title[locale]} category={entry.category} />
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold text-foam">{entry.title[locale]}</span>
          <span className="block truncate text-[13px] text-mist">{entry.pitch[locale]}</span>
        </span>
        {entry.done ? (
          <Validated />
        ) : (
          <span className="shrink-0 font-extrabold text-straw">{formatNumber(entry.berrys, locale)} ฿</span>
        )}
      </Link>
    </li>
  );
}

/**
 * Les jeux du jour : le défi du jour et les jeux tirés pour la journée, les
 * seuls à rapporter des Berrys, une fois chacun. La sélection dépend de la
 * date : elle n'est calculée que dans le navigateur.
 */
export function DailyGames() {
  const { ready, entries, count, total } = useDaily();
  const countdown = useUntilMidnight();
  const t = useT();
  const locale = useLocale();
  const [challenge, ...games] = entries;

  return (
    <section id="jeux-du-jour" aria-labelledby="jeux-du-jour-titre" className="scroll-mt-6 space-y-5 rounded-[20px] border border-straw/50 bg-straw/5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="jeux-du-jour-titre" className="font-display text-3xl tracking-wide text-straw sm:text-[34px]">
            {t("Les jeux du jour", "Daily games")}
          </h2>
          <p className="mt-0.5 max-w-xl text-[15px] text-mist">
            {t(
              `${total} jeux rapportent des Berrys aujourd'hui, une fois chacun, à partir de ${pass(locale)} des points.`,
              `${total} games pay out Berries today, once each, starting at ${pass(locale)} of the points.`,
            )}
          </p>
        </div>
        <div className={`sm:text-right ${ready ? "" : "invisible"}`} aria-live="polite">
          <p className="font-display text-[32px] leading-none tracking-wide text-foam">
            {count} / {total}{" "}
            <span className="font-sans text-[15px] font-bold text-mist">{t("validés", "cleared")}</span>
          </p>
          <p className="mt-1 text-sm text-mist">
            {t("Nouvelle sélection dans", "New selection in")} {countdown ?? "…"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2.5 rounded-xl border-4 border-parchment-dark bg-parchment p-5 text-ink">
          <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-[0.25em] uppercase">
            {ready && challenge.done && <CheckIcon className="size-3.5" />}
            {ready && challenge.done
              ? t("Défi du jour validé", "Daily challenge cleared")
              : t("Défi du jour", "Daily challenge")}
          </p>
          <p className="font-display text-[42px] leading-none tracking-wide sm:text-[46px]">
            {challenge.title[locale]}
          </p>
          <p className="text-[15px]">{challenge.pitch[locale]}</p>
          <p className="mt-auto flex flex-wrap items-baseline gap-x-3 pt-2">
            <span className="font-display text-[34px] leading-none tracking-wide">
              ฿ {formatNumber(challenge.berrys, locale)}
            </span>
            <span className="text-sm font-extrabold">{t("+ une recrue assurée", "+ a guaranteed recruit")}</span>
          </p>
          <Link
            href={challenge.href}
            className="flex min-h-[52px] items-center justify-center rounded-[10px] bg-ink px-4 font-extrabold text-parchment transition-colors hover:bg-ink/85"
          >
            {ready && challenge.done
              ? t("Rejouer en partie libre", "Play again in free play")
              : t("Jouer le défi", "Play the challenge")}
          </Link>
        </div>

        <ul className="flex min-w-0 flex-col gap-2.5">
          {ready
            ? games.map((entry) => <DailyRow key={entry.key} entry={entry} />)
            : // Avant que le navigateur ne connaisse la date : des cases vides, à la taille des vraies
              Array.from({ length: DAILY_GAMES }, (_, i) => (
                <li key={i} className="h-[60px] rounded-xl border border-sea-700 bg-sea-800/50" aria-hidden="true" />
              ))}
        </ul>
      </div>
    </section>
  );
}

/** Rappel compact des jeux du jour, en tête du catalogue et des défis. */
export function DailyStrip({ segments = false }: { segments?: boolean }) {
  const { ready, count, total, entries } = useDaily();
  const countdown = useUntilMidnight();
  const t = useT();
  const locale = useLocale();
  const left = total - count;
  const remaining = entries.filter((entry) => !entry.done).reduce((sum, entry) => sum + entry.berrys, 0);

  if (!segments) {
    return (
      <Link
        href="/#jeux-du-jour"
        className={`flex min-h-12 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-straw/50 bg-straw/5 px-4 py-2 text-[15px] font-bold transition-colors hover:bg-straw/10 sm:w-auto ${
          ready ? "" : "invisible"
        }`}
      >
        <span className="text-foam">
          {t(`Jeux du jour : ${count} / ${total} validés`, `Daily games: ${count} / ${total} cleared`)}
        </span>
        <span className="text-straw">
          {left > 0 ? t(`encore ${left} à jouer`, `${left} left to play`) : t("tout est validé", "all cleared")}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/#jeux-du-jour"
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-straw/50 bg-straw/5 px-5 py-4 transition-colors hover:bg-straw/10"
    >
      <span className={ready ? "" : "invisible"}>
        <span className="block text-xs font-extrabold tracking-[0.15em] text-straw uppercase">
          {t(`Aujourd'hui · encore ${countdown ?? "…"}`, `Today · ${countdown ?? "…"} left`)}
        </span>
        <span className="block text-[19px] font-extrabold text-foam">
          {t(
            `${count} jeu${count > 1 ? "x" : ""} du jour validé${count > 1 ? "s" : ""} sur ${total}`,
            `${count} of ${total} daily games cleared`,
          )}
        </span>
      </span>
      <span className="flex min-w-40 flex-1">
        <Segments
          total={total}
          filled={ready ? count : 0}
          label={t(`${count} jeux du jour validés sur ${total}`, `${count} of ${total} daily games cleared`)}
          className="h-2.5"
        />
      </span>
      <span className={`text-[15px] font-extrabold text-straw ${ready ? "" : "invisible"}`}>
        {left > 0
          ? t(
              `Reste ${formatNumber(remaining, locale)} ฿ à prendre`,
              `${formatNumber(remaining, locale)} ฿ still up for grabs`,
            )
          : t("Tout est validé, reviens demain", "All cleared, come back tomorrow")}
      </span>
      <span className="flex min-h-11 items-center rounded-[10px] bg-straw px-5 text-[15px] font-extrabold text-ink">
        {t("Voir les jeux du jour", "See the daily games")}
      </span>
    </Link>
  );
}

/** Sur la page d'un jeu : rapporte-t-il des Berrys aujourd'hui ? */
export function DailyChip({ slug }: { slug: LiveSlug }) {
  const { ready, entries } = useDaily();
  const t = useT();
  const locale = useLocale();
  if (isRewardless(slug)) return null;
  const entry = entries.find((e) => e.slug === slug);

  const base = "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-bold";
  if (!ready) return <span className={`${base} invisible border-transparent`}>{t("Jeu du jour", "Daily game")}</span>;

  if (!entry) {
    return (
      <span className={`${base} border-sea-700 text-mist`}>
        {t(
          `Hors sélection du jour : pas de Berrys, mais ${Math.round(OFF_DAY_RECRUIT_CHANCE * 100)} % de chances de recrue`,
          `Not in today's selection: no Berries, but a ${Math.round(OFF_DAY_RECRUIT_CHANCE * 100)}% chance of a recruit`,
        )}{" "}
        ·{" "}
        <Link href="/#jeux-du-jour" className="text-straw underline underline-offset-4">
          {t("Voir les jeux du jour", "See the daily games")}
        </Link>
      </span>
    );
  }
  if (entry.done) {
    return (
      <span className={`${base} border-emerald-400/50 bg-emerald-600/15 text-emerald-200`}>
        <CheckIcon className="size-3.5" />
        {entry.challenge
          ? t(
              "Défi du jour validé · la partie libre ne rapporte pas de Berrys",
              "Daily challenge cleared · free play doesn't earn Berries",
            )
          : t(
              "Jeu du jour validé · rejouer compte pour tes objectifs",
              "Daily game cleared · playing again counts toward your goals",
            )}
      </span>
    );
  }
  return (
    <span className={`${base} border-straw/50 bg-straw/10 text-straw`}>
      {entry.challenge
        ? t(
            `Défi du jour · jusqu'à ${formatNumber(entry.berrys, locale)} ฿ et une recrue assurée`,
            `Daily challenge · up to ${formatNumber(entry.berrys, locale)} ฿ and a guaranteed recruit`,
          )
        : t(
            `Jeu du jour · ${formatNumber(entry.berrys, locale)} ฿ à partir de ${pass(locale)} des points`,
            `Daily game · ${formatNumber(entry.berrys, locale)} ฿ starting at ${pass(locale)} of the points`,
          )}
    </span>
  );
}

/** Les jeux du jour qui restent à valider, hormis celui qu'on regarde. */
export function OtherDailyGames({ slug }: { slug: LiveSlug }) {
  const { ready, entries } = useDaily();
  const t = useT();
  const locale = useLocale();
  const others = entries.filter((entry) => entry.slug !== slug && !entry.done);
  if (!ready || others.length === 0) return null;

  return (
    <section aria-labelledby="autres-jeux-du-jour" className="space-y-3">
      <h2 id="autres-jeux-du-jour" className="text-lg font-extrabold text-foam">
        {t("Les autres jeux du jour", "The other daily games")}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {others.map((entry) => (
          <li key={entry.key}>
            <Link
              href={entry.href}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-sea-600 bg-sea-800 px-3.5 py-2 font-bold text-foam transition-colors hover:border-straw"
            >
              <GameBadge title={entry.title[locale]} category={entry.category} className="size-8 text-lg" />
              <span className="min-w-0 flex-1 truncate">
                {entry.challenge ? t("Le défi du jour", "The daily challenge") : entry.title[locale]}
              </span>
              <span className="shrink-0 text-straw">{formatNumber(entry.berrys, locale)} ฿</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
