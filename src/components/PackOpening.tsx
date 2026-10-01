"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ResolvedData } from "@/games/cards";
import { Button } from "@/games/ui/primitives";
import { BOOSTER_SIZE, type Recruit } from "@/lib/economy";
import { CharacterCard } from "./CharacterCard";
import { Modal } from "./Modal";

/** Halo d'une carte retournée, selon sa rareté ; les communes n'en ont pas. */
const GLOWS: Record<number, string> = {
  1: "rgb(242 193 78 / 0.9)",
  2: "rgb(167 139 250 / 0.85)",
  3: "rgb(56 189 248 / 0.55)",
};

/** Le paquet scellé : il sert aussi d'illustration à l'offre, dans la boutique. */
export function PackArt({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative flex aspect-[3/4] flex-col items-center justify-between overflow-hidden rounded-xl border-4 border-straw bg-gradient-to-br from-vest via-vest-dark to-sea-900 p-3 text-center shadow-2xl ${className}`}
    >
      {/* Soudure du sachet, en haut et en bas */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-3 bg-[repeating-linear-gradient(90deg,#0003_0_4px,transparent_4px_8px)]" />
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3 bg-[repeating-linear-gradient(90deg,#0003_0_4px,transparent_4px_8px)]" />
      <span className="mt-3 font-display text-xl tracking-widest text-straw">Booster</span>
      <span aria-hidden="true" className="font-display text-6xl text-parchment drop-shadow-lg">
        ☠
      </span>
      <span className="mb-3 text-xs font-bold tracking-wide text-parchment uppercase">{BOOSTER_SIZE} avis de recherche</span>
    </div>
  );
}

function CardBack() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 rounded-md border-4 border-parchment-dark bg-[repeating-linear-gradient(45deg,var(--color-sea-800)_0_10px,var(--color-sea-700)_10px_20px)] text-straw shadow-lg">
      <span className="font-display text-2xl tracking-widest">Wanted</span>
      <span aria-hidden="true" className="font-display text-4xl">
        ฿
      </span>
    </div>
  );
}

/**
 * Ouverture d'un achat de la boutique : le paquet éclate, les cartes sont
 * distribuées face cachée, et le joueur les retourne. Les avis sont déjà dans
 * sa collection : fermer la fenêtre avant la fin ne fait rien perdre.
 */
export function PackOpening({
  recruits,
  data,
  onClose,
  again,
}: {
  recruits: Recruit[];
  data: ResolvedData;
  onClose: () => void;
  /** Rachat du même article, proposé une fois toutes les cartes retournées. */
  again: { label: string; disabled: boolean; run: () => void };
}) {
  const sealed = recruits.length > 1;
  const [stage, setStage] = useState<"pack" | "opening" | "cards">(sealed ? "pack" : "cards");
  const [flipped, setFlipped] = useState<boolean[]>(() => recruits.map(() => false));
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);
  const later = (run: () => void, ms: number) => timers.current.push(window.setTimeout(run, ms));

  const flip = (index: number) => setFlipped((current) => current.map((value, i) => value || i === index));
  const allFlipped = flipped.every(Boolean);
  const fresh = recruits.filter((recruit) => !recruit.duplicate).length;

  function open() {
    if (stage !== "pack") return;
    setStage("opening");
    // Durée de l'animation du paquet ; un minuteur plutôt que la fin de l'animation, qui peut être désactivée
    later(() => setStage("cards"), 650);
  }

  function flipAll() {
    recruits.forEach((_, index) => {
      if (!flipped[index]) later(() => flip(index), 180 * index);
    });
  }

  return (
    <Modal title={sealed ? "Ouverture du booster" : "Nouvelle recrue"} onClose={onClose} wide>
      {stage !== "cards" ? (
        <div className="flex flex-col items-center gap-5 py-4">
          <button
            type="button"
            onClick={open}
            autoFocus
            aria-label="Ouvrir le booster"
            className={`w-44 rounded-xl ${stage === "opening" ? "motion-safe:animate-pack-open" : "cursor-pointer motion-safe:animate-pack-idle"}`}
          >
            <PackArt />
          </button>
          <p className="text-mist" aria-live="polite">
            {stage === "opening" ? "…" : "Clique sur le booster pour l'ouvrir."}
          </p>
        </div>
      ) : (
        <>
          <ul className={`grid gap-3 ${sealed ? "grid-cols-3 sm:grid-cols-5" : "mx-auto max-w-44 grid-cols-1"}`}>
            {recruits.map((recruit, index) => {
              const character = data.characterById.get(recruit.characterId) ?? null;
              const shown = flipped[index];
              const glow = shown && character ? GLOWS[character.tier] : undefined;
              return (
                <li key={index} className="space-y-1.5 text-center motion-safe:animate-card-deal" style={{ animationDelay: `${index * 110}ms` }}>
                  <div className="relative perspective-[900px]">
                    <div className={`relative transition-transform duration-700 transform-3d ${shown ? "rotate-y-180" : ""}`}>
                      {/* Face avant : le personnage n'est écrit dans la page qu'une fois la carte retournée */}
                      <div
                        className={`rotate-y-180 rounded-md backface-hidden ${glow && character && character.tier <= 2 ? "motion-safe:animate-card-glow" : ""}`}
                        style={glow ? ({ "--glow": glow, boxShadow: `0 0 16px 3px ${glow}` } as CSSProperties) : undefined}
                      >
                        <CharacterCard character={shown ? character : null} golden={shown && recruit.golden} />
                        {shown && recruit.golden && (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 rounded-md bg-[linear-gradient(110deg,transparent_35%,rgb(255_255_255/0.55)_50%,transparent_65%)] bg-[length:200%_100%] motion-safe:animate-shine"
                          />
                        )}
                      </div>
                      <div className="absolute inset-0 backface-hidden" aria-hidden="true">
                        <CardBack />
                      </div>
                    </div>
                    {!shown && (
                      <button
                        type="button"
                        onClick={() => flip(index)}
                        autoFocus={index === 0}
                        aria-label={`Retourner la carte ${index + 1}`}
                        className="absolute inset-0 cursor-pointer rounded-md transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-straw"
                      />
                    )}
                  </div>
                  <p className="min-h-5 text-xs font-bold" aria-live="polite">
                    {shown && character && (
                      <span className="motion-safe:animate-card-label">
                        {/* La rareté est déjà sur la carte : ici, seulement ce qu'elle change pour la collection */}
                        <span className={recruit.duplicate ? "text-mist" : "text-emerald-300"}>{recruit.duplicate ? "Doublon" : "Nouveau !"}</span>
                        {recruit.golden && <span className="text-straw"> · doré</span>}
                      </span>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
            {allFlipped ? (
              <>
                <p className="font-semibold text-foam">
                  {sealed
                    ? `${fresh === 0 ? "Aucun nouvel" : fresh === 1 ? "1 nouvel" : `${fresh} nouveaux`} avis, ${recruits.length - fresh} doublon${recruits.length - fresh > 1 ? "s" : ""}.`
                    : fresh
                      ? "Un nouvel avis rejoint ta collection."
                      : "Tu avais déjà cet avis : c'est un doublon."}{" "}
                  <Link href="/collection" className="font-semibold text-straw underline underline-offset-4">
                    Voir ma collection
                  </Link>
                </p>
                <span className="flex flex-wrap gap-2">
                  <Button onClick={again.run} disabled={again.disabled}>
                    {again.label}
                  </Button>
                  <Button variant="secondary" onClick={onClose}>
                    Fermer
                  </Button>
                </span>
              </>
            ) : (
              <>
                <p className="text-mist">Clique sur une carte pour la retourner.</p>
                {sealed && (
                  <Button variant="secondary" onClick={flipAll}>
                    Tout retourner
                  </Button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
