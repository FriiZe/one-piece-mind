"use client";

import Link from "next/link";
import type { ResolvedData } from "@/games/cards";
import { formatNumber } from "@/games/engine/text";
import { usePlayer } from "@/lib/player/PlayerProvider";
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

/** Ce que la partie a rapporté : Berrys et, parfois, un avis de recherche. */
export function RewardSummary({ view, data }: { view: RewardView | null; data: ResolvedData }) {
  const { status, accountsEnabled } = usePlayer();
  if (!view) return null;
  if (view.status === "pending") return <p className="text-sm font-semibold">Calcul de la récompense…</p>;
  if (!view.result.ok) return <p className="text-sm font-semibold">{REFUSALS[view.result.reason]}</p>;

  const { reward } = view.result;
  const recruit = reward.recruit;
  const character = recruit ? (data.characterById.get(recruit.characterId) ?? null) : null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border-2 border-ink/15 bg-white/50 p-3" aria-live="polite">
      <div className="min-w-0 flex-1">
        {reward.daily !== "paid" && <p className="text-sm font-semibold">{UNPAID[reward.daily]}</p>}
        {(reward.daily === "paid" || reward.total > 0) && (
          <p className="font-display text-3xl tracking-wide text-vest-dark">+{formatNumber(reward.total)} ฿</p>
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
        <p className="mt-1 text-sm">
          {reward.daily === "paid" ? (
            <Link href="/collection" className="underline underline-offset-4">
              Voir ma collection
            </Link>
          ) : (
            <Link href="/#jeux-du-jour" className="underline underline-offset-4">
              Voir les jeux du jour
            </Link>
          )}
          {status === "guest" && accountsEnabled && (
            <>
              {" · "}
              <Link href="/profil" className="underline underline-offset-4">
                Créer un compte pour la sauvegarder
              </Link>
            </>
          )}
        </p>
      </div>
      {recruit && (
        <div className="w-28 shrink-0">
          <CharacterCard character={character} golden={recruit.golden} />
        </div>
      )}
    </div>
  );
}
