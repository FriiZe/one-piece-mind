"use client";

import Link from "@/components/Link";
import type { ResolvedData } from "@/games/cards";
import { formatNumber } from "@/games/engine/text";
import { useUntilMidnight } from "@/games/ui/storage";
import { OFF_DAY_RECRUIT_CHANCE } from "@/lib/economy";
import { useLocale, usePath, useT } from "@/lib/i18n/client";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { useDaily } from "@/lib/player/useDaily";
import type { RewardView } from "@/lib/player/useGameReward";
import { CharacterCard } from "./CharacterCard";

const REFUSALS = {
  fr: {
    duplicate: "Cette partie a déjà été récompensée.",
    invalid: "Cette partie n'a pas pu être validée : pas de récompense.",
    limit: "Trop de parties en peu de temps : pas de récompense pour celle-ci.",
    unavailable: "Récompense indisponible pour l'instant. Réessaie dans un moment.",
  },
  en: {
    duplicate: "This game has already been rewarded.",
    invalid: "This game couldn't be verified: no reward.",
    limit: "Too many games in a short time: no reward for this one.",
    unavailable: "Rewards are unavailable right now. Try again in a moment.",
  },
} as const;

/** Pourquoi une partie n'a pas rapporté de Berrys : seuls les jeux du jour en paient, une fois chacun. */
const UNPAID = {
  fr: {
    off: `Hors sélection du jour : pas de Berrys. Une partie réussie a ${Math.round(OFF_DAY_RECRUIT_CHANCE * 100)} % de chances de rapporter une recrue.`,
    done: "Tu as déjà validé ce jeu aujourd'hui : il rapportera de nouveau des Berrys un autre jour.",
    missed: "Jeu du jour non validé : il faut au moins la moitié des points. Tu peux retenter ta chance.",
  },
  en: {
    off: `Not in today's selection: no Berries. A successful game has a ${Math.round(OFF_DAY_RECRUIT_CHANCE * 100)}% chance of earning you a recruit.`,
    done: "You've already cleared this game today: it will pay Berries again another day.",
    missed: "Daily game not cleared: you need at least half the points. You can try your luck again.",
  },
} as const;

/** Où en sont les jeux du jour, et le prochain à jouer : la fin d'une partie mène à la suivante. */
function DailyNext() {
  const { ready, entries, count, total } = useDaily();
  const pathname = usePath();
  const countdown = useUntilMidnight();
  const t = useT();
  const locale = useLocale();
  if (!ready) return null;
  const next = entries.find((entry) => !entry.done && entry.href !== pathname);

  return (
    <div className="space-y-2">
      <p className="flex justify-between gap-3 text-sm font-bold">
        <span>{t("Jeux du jour", "Daily games")}</span>
        <span>
          {count} / {total} {t("validés", "cleared")}
        </span>
      </p>
      <span
        className="flex gap-1.5"
        role="img"
        aria-label={t(`${count} jeux du jour validés sur ${total}`, `${count} daily games cleared out of ${total}`)}
      >
        {entries.map((entry, index) => (
          <span key={entry.key} className={`h-2 flex-1 rounded-full ${index < count ? "bg-emerald-700" : "bg-parchment-dark"}`} />
        ))}
      </span>
      {next ? (
        <Link
          href={next.href}
          className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-ink px-4 py-2 text-parchment transition-colors hover:bg-ink/85"
        >
          <span>
            <span className="block text-xs font-extrabold tracking-[0.15em] uppercase opacity-80">
              {t("Jeu du jour suivant", "Next daily game")}
            </span>
            <span className="block text-lg leading-tight font-extrabold">
              {next.challenge ? t("Le défi du jour", "The daily challenge") : next.title[locale]} ·{" "}
              {formatNumber(next.berrys, locale)} ฿
            </span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5 shrink-0">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      ) : (
        <p className="text-sm font-semibold">
          {count === total
            ? t("Tous les jeux du jour sont validés.", "All daily games are cleared.")
            : t(
                "Il ne te reste que ce jeu à valider aujourd'hui.",
                "This is the only game you have left to clear today.",
              )}{" "}
          {t("Nouvelle sélection dans", "New selection in")} {countdown ?? t("quelques heures", "a few hours")}.
        </p>
      )}
    </div>
  );
}

/** Ce que la partie a rapporté : Berrys et, parfois, un avis de recherche. Puis le jeu du jour suivant. */
export function RewardSummary({ view, data }: { view: RewardView | null; data: ResolvedData }) {
  const { status, accountsEnabled } = usePlayer();
  const t = useT();
  const locale = useLocale();
  if (!view) return null;
  if (view.status === "pending") {
    return <p className="text-sm font-semibold">{t("Calcul de la récompense…", "Working out your reward…")}</p>;
  }
  if (!view.result.ok) return <p className="text-sm font-semibold">{REFUSALS[locale][view.result.reason]}</p>;

  const { reward } = view.result;
  const recruit = reward.recruit;
  const character = recruit ? (data.characterById.get(recruit.characterId) ?? null) : null;

  return (
    <div className="mt-3 space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-ink/15 bg-white/50 p-3">
        <div className="min-w-0 flex-1 basis-52">
          {reward.daily === "paid" ? (
            <p className="text-xs font-extrabold tracking-[0.15em] uppercase">{t("Jeu du jour validé", "Daily game cleared")}</p>
          ) : (
            <p className="text-sm font-semibold">
              {reward.daily === "off" && recruit
                ? t(
                    "Hors sélection du jour : pas de Berrys, mais une recrue.",
                    "Not in today's selection: no Berries, but a recruit.",
                  )
                : UNPAID[locale][reward.daily]}
            </p>
          )}
          {(reward.daily === "paid" || reward.total > 0) && (
            <p className="font-display text-[34px] leading-tight tracking-wide text-vest-dark">+{formatNumber(reward.total, locale)} ฿</p>
          )}
          {reward.bonus > 0 && (
            <p className="text-sm">
              {t(
                `dont ${formatNumber(reward.bonus, locale)} ฿ grâce à ton équipage`,
                `including ${formatNumber(reward.bonus, locale)} ฿ thanks to your crew`,
              )}
            </p>
          )}
          {reward.capped && (
            <p className="text-sm font-semibold">{t("Plafond de gains du jour atteint.", "Daily earnings cap reached.")}</p>
          )}
          {(reward.objectives.length > 0 || reward.dailies.length > 0 || reward.weekly.length > 0) && (
            <ul className="mt-1 space-y-0.5 text-sm font-semibold">
              {reward.objectives.map((objective) => (
                <li key={objective.label.fr}>
                  {t("Objectif atteint : ", "Goal reached: ")}
                  {objective.label[locale]} (+{formatNumber(objective.berrys, locale)} ฿)
                </li>
              ))}
              {reward.dailies.map((challenge) => (
                <li key={challenge.label.fr}>
                  {t("Défi quotidien réussi : ", "Daily challenge completed: ")}
                  {challenge.label[locale]} (+{formatNumber(challenge.berrys, locale)} ฿)
                </li>
              ))}
              {reward.weekly.map((challenge) => (
                <li key={challenge.label.fr}>
                  {t("Défi de la semaine réussi : ", "Weekly challenge completed: ")}
                  {challenge.label[locale]} (+{formatNumber(challenge.berrys, locale)} ฿)
                </li>
              ))}
            </ul>
          )}
          {status === "guest" && accountsEnabled && (
            <p className="mt-1 text-sm">
              <Link href="/profil" className="underline underline-offset-4">
                {t("Créer un compte pour tout garder", "Create an account to keep everything")}
              </Link>
            </p>
          )}
        </div>
        {/* La recrue a sa colonne : l'avis, puis son nom en entier (la carte le coupe) et ce qu'on peut en faire */}
        {recruit && (
          <div className="mx-auto flex w-40 shrink-0 flex-col items-center gap-2 text-center sm:w-44">
            <div className="w-28">
              <CharacterCard character={character} golden={recruit.golden} />
            </div>
            <p className="text-sm font-semibold">
              {recruit.duplicate
                ? t(
                    `Nouvel avis de ${character?.name ?? "ce personnage"} : tu l'avais déjà.`,
                    `New poster of ${character?.name ?? "this character"}: you already had it.`,
                  )
                : t(
                    `${character?.name ?? "Un personnage"} rejoint ta collection !`,
                    `${character?.name ?? "A character"} joins your collection!`,
                  )}
              {recruit.golden && t(" Avis doré !", " Golden poster!")}
            </p>
            <Link
              href={recruit.duplicate ? "/collection" : "/navire"}
              className="inline-flex min-h-9 items-center rounded-lg bg-ink px-3 text-sm font-bold text-parchment transition-colors hover:bg-ink/85"
            >
              {recruit.duplicate ? t("Voir ma collection", "View my collection") : t("Lui confier un poste", "Give them a post")}
            </Link>
          </div>
        )}
      </div>
      <DailyNext />
    </div>
  );
}
