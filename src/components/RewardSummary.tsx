"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ResolvedData } from "@/games/cards";
import { formatNumber } from "@/games/engine/text";
import { useUntilMidnight } from "@/games/ui/storage";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { useDaily } from "@/lib/player/useDaily";
import type { RewardView } from "@/lib/player/useGameReward";
import { CharacterCard } from "./CharacterCard";

const REFUSALS = {
  duplicate: "Cette partie a déjà été récompensée.",
  invalid: "Cette partie n'a pas pu être validée : pas de récompense.",
  limit: "Trop de parties en peu de temps : pas de récompense pour celle-ci.",
  unavailable: "Récompense indisponible pour l'instant. Réessaie dans un moment.",
} as const;

/** Pourquoi une partie n'a pas rapporté de Berrys : seuls les jeux du jour paient, une fois chacun. */
const UNPAID = {
  off: "Ce jeu n'est pas dans la sélection du jour : cette partie ne rapporte pas de Berrys.",
  done: "Tu as déjà validé ce jeu aujourd'hui : il rapportera de nouveau des Berrys un autre jour.",
  missed: "Jeu du jour non validé : il faut au moins la moitié des points. Tu peux retenter ta chance.",
} as const;

/** Où en sont les jeux du jour, et le prochain à jouer : la fin d'une partie mène à la suivante. */
function DailyNext() {
  const { ready, entries, count, total } = useDaily();
  const pathname = usePathname();
  const countdown = useUntilMidnight();
  if (!ready) return null;
  const next = entries.find((entry) => !entry.done && entry.href !== pathname);

  return (
    <div className="space-y-2">
      <p className="flex justify-between gap-3 text-sm font-bold">
        <span>Jeux du jour</span>
        <span>
          {count} / {total} validés
        </span>
      </p>
      <span className="flex gap-1.5" role="img" aria-label={`${count} jeux du jour validés sur ${total}`}>
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
            <span className="block text-xs font-extrabold tracking-[0.15em] uppercase opacity-80">Jeu du jour suivant</span>
            <span className="block text-lg leading-tight font-extrabold">
              {next.challenge ? "Le défi du jour" : next.title} · {formatNumber(next.berrys)} ฿
            </span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5 shrink-0">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      ) : (
        <p className="text-sm font-semibold">
          {count === total ? "Tous les jeux du jour sont validés." : "Il ne te reste que ce jeu à valider aujourd'hui."} Nouvelle sélection dans{" "}
          {countdown ?? "quelques heures"}.
        </p>
      )}
    </div>
  );
}

/** Ce que la partie a rapporté : Berrys et, parfois, un avis de recherche. Puis le jeu du jour suivant. */
export function RewardSummary({ view, data }: { view: RewardView | null; data: ResolvedData }) {
  const { status, accountsEnabled } = usePlayer();
  if (!view) return null;
  if (view.status === "pending") return <p className="text-sm font-semibold">Calcul de la récompense…</p>;
  if (!view.result.ok) return <p className="text-sm font-semibold">{REFUSALS[view.result.reason]}</p>;

  const { reward } = view.result;
  const recruit = reward.recruit;
  const character = recruit ? (data.characterById.get(recruit.characterId) ?? null) : null;

  return (
    <div className="mt-3 space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-ink/15 bg-white/50 p-3">
        <div className="min-w-0 flex-1">
          {reward.daily === "paid" ? (
            <p className="text-xs font-extrabold tracking-[0.15em] uppercase">Jeu du jour validé</p>
          ) : (
            <p className="text-sm font-semibold">{UNPAID[reward.daily]}</p>
          )}
          {(reward.daily === "paid" || reward.total > 0) && (
            <p className="font-display text-[34px] leading-tight tracking-wide text-vest-dark">+{formatNumber(reward.total)} ฿</p>
          )}
          {reward.bonus > 0 && <p className="text-sm">dont {formatNumber(reward.bonus)} ฿ grâce à ton équipage</p>}
          {reward.capped && <p className="text-sm font-semibold">Plafond de gains du jour atteint.</p>}
          {(reward.objectives.length > 0 || reward.weekly.length > 0) && (
            <ul className="mt-1 space-y-0.5 text-sm font-semibold">
              {reward.objectives.map((objective) => (
                <li key={objective.label}>
                  Objectif atteint : {objective.label} (+{formatNumber(objective.berrys)} ฿)
                </li>
              ))}
              {reward.weekly.map((challenge) => (
                <li key={challenge.label}>
                  Défi de la semaine réussi : {challenge.label} (+{formatNumber(challenge.berrys)} ฿)
                </li>
              ))}
            </ul>
          )}
          {recruit && (
            <p className="mt-1 font-semibold">
              {recruit.duplicate
                ? `Nouvel avis de ${character?.name ?? "ce personnage"} : tu l'avais déjà.`
                : `${character?.name ?? "Un personnage"} rejoint ta collection !`}
              {recruit.golden && " Avis doré !"}
            </p>
          )}
          {(recruit || (status === "guest" && accountsEnabled)) && (
            <p className="mt-1 text-sm">
              {recruit &&
                (recruit.duplicate ? (
                  <Link href="/collection" className="underline underline-offset-4">
                    Voir ma collection
                  </Link>
                ) : (
                  <Link href="/navire" className="underline underline-offset-4">
                    Lui confier un poste
                  </Link>
                ))}
              {recruit && status === "guest" && accountsEnabled && " · "}
              {status === "guest" && accountsEnabled && (
                <Link href="/profil" className="underline underline-offset-4">
                  Créer un compte pour tout garder
                </Link>
              )}
            </p>
          )}
        </div>
        {recruit && (
          <div className="w-24 shrink-0 sm:w-28">
            <CharacterCard character={character} golden={recruit.golden} />
          </div>
        )}
      </div>
      <DailyNext />
    </div>
  );
}
