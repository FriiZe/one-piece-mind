"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "@/components/Link";
import type { ResolvedData } from "@/games/cards";
import { Button } from "@/games/ui/primitives";
import { BOOSTER_SIZE, type Recruit } from "@/lib/economy";
import { useT } from "@/lib/i18n/client";
import { CharacterCard } from "./CharacterCard";
import { Modal } from "./Modal";

/** Couleur du halo d'une carte au survol, selon sa rareté (voir `.card-halo` dans globals.css). */
const GLOWS: Record<number, string> = {
  1: "rgb(242 193 78 / 0.95)",
  2: "rgb(167 139 250 / 0.9)",
  3: "rgb(56 189 248 / 0.6)",
  4: "rgb(157 178 200 / 0.4)",
};

/** Une face de carte : elle apparaît ou disparaît d'un coup, à la moitié du demi-tour (700 ms). */
const FACE = "transition-[visibility] delay-[350ms] duration-0";

/** Le paquet scellé : il sert aussi d'illustration à l'offre, dans la boutique. */
export function PackArt({ className = "" }: { className?: string }) {
  const t = useT();
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
      <span className="mb-3 text-xs font-bold tracking-wide text-parchment uppercase">
        {t(`${BOOSTER_SIZE} avis de recherche`, `${BOOSTER_SIZE} wanted posters`)}
      </span>
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
  const t = useT();
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
    <Modal
      title={sealed ? t("Ouverture du booster", "Opening the booster") : t("Nouvelle recrue", "New recruit")}
      onClose={onClose}
      wide
    >
      {stage !== "cards" ? (
        <div className="flex flex-col items-center gap-5 py-4">
          <button
            type="button"
            onClick={open}
            autoFocus
            aria-label={t("Ouvrir le booster", "Open the booster")}
            className={`w-44 rounded-xl ${stage === "opening" ? "motion-safe:animate-pack-open" : "cursor-pointer motion-safe:animate-pack-idle"}`}
          >
            <PackArt />
          </button>
          <p className="text-mist" aria-live="polite">
            {stage === "opening" ? "…" : t("Clique sur le booster pour l'ouvrir.", "Click the booster to open it.")}
          </p>
        </div>
      ) : (
        <>
          <ul className={`grid gap-3 ${sealed ? "grid-cols-3 sm:grid-cols-5" : "mx-auto max-w-44 grid-cols-1"}`}>
            {recruits.map((recruit, index) => {
              const character = data.characterById.get(recruit.characterId) ?? null;
              const shown = flipped[index];
              const glow = GLOWS[character?.tier ?? 4];
              return (
                <li key={index} className="space-y-1.5 text-center motion-safe:animate-card-deal" style={{ animationDelay: `${index * 110}ms` }}>
                  <div
                    className="card-halo relative perspective-[900px]"
                    data-shown={shown}
                    data-strong={!!character && character.tier <= 2}
                    style={{ "--glow": glow } as CSSProperties}
                  >
                    {/*
                      La carte fait un demi-tour, et ses deux faces s'échangent à mi-course, quand elle est
                      de profil. Rien ne repose sur `backface-visibility` ni sur `preserve-3d` : Firefox et
                      Chrome ne les traitent pas pareil, et les cartes ne s'affichaient pas sous Firefox.
                    */}
                    <div className={`relative transition-transform duration-700 ease-in-out ${shown ? "rotate-y-180" : ""}`}>
                      {/*
                        Face avant, en miroir : le demi-tour du conteneur la remet à l'endroit. Le personnage
                        n'est écrit dans la page qu'une fois la carte retournée.
                      */}
                      <div className={`${FACE} -scale-x-100 rounded-md ${shown ? "visible" : "invisible"}`}>
                        <CharacterCard character={shown ? character : null} golden={shown && recruit.golden} eager />
                        {shown && recruit.golden && (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 rounded-md bg-[linear-gradient(110deg,transparent_35%,rgb(255_255_255/0.55)_50%,transparent_65%)] bg-[length:200%_100%] motion-safe:animate-shine"
                          />
                        )}
                      </div>
                      <div className={`${FACE} absolute inset-0 ${shown ? "invisible" : "visible"}`} aria-hidden="true">
                        <CardBack />
                      </div>
                    </div>
                    {!shown && (
                      <button
                        type="button"
                        onClick={() => flip(index)}
                        autoFocus={index === 0}
                        aria-label={t(`Retourner la carte ${index + 1}`, `Flip card ${index + 1}`)}
                        className="absolute inset-0 cursor-pointer rounded-md transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-straw"
                      />
                    )}
                  </div>
                  <p className="min-h-5 text-xs font-bold" aria-live="polite">
                    {shown && character && (
                      <span className="motion-safe:animate-card-label">
                        {/* La rareté est déjà sur la carte : ici, seulement ce qu'elle change pour la collection */}
                        <span className={recruit.duplicate ? "text-mist" : "text-emerald-300"}>
                          {recruit.duplicate ? t("Doublon", "Duplicate") : t("Nouveau !", "New!")}
                        </span>
                        {recruit.golden && <span className="text-straw">{t(" · doré", " · golden")}</span>}
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
                    ? t(
                        `${fresh === 0 ? "Aucun nouvel" : fresh === 1 ? "1 nouvel" : `${fresh} nouveaux`} avis, ${recruits.length - fresh} doublon${recruits.length - fresh > 1 ? "s" : ""}.`,
                        `${fresh === 0 ? "No new posters" : fresh === 1 ? "1 new poster" : `${fresh} new posters`}, ${recruits.length - fresh} ${recruits.length - fresh === 1 ? "duplicate" : "duplicates"}.`,
                      )
                    : fresh
                      ? t("Un nouvel avis rejoint ta collection.", "A new poster joins your collection.")
                      : t("Tu avais déjà cet avis : c'est un doublon.", "You already had this poster: it's a duplicate.")}{" "}
                  <Link href="/collection" className="font-semibold text-straw underline underline-offset-4">
                    {t("Voir ma collection", "View my collection")}
                  </Link>
                </p>
                <span className="flex flex-wrap gap-2">
                  <Button onClick={again.run} disabled={again.disabled}>
                    {again.label}
                  </Button>
                  <Button variant="secondary" onClick={onClose}>
                    {t("Fermer", "Close")}
                  </Button>
                </span>
              </>
            ) : (
              <>
                <p className="text-mist">{t("Clique sur une carte pour la retourner.", "Click a card to flip it.")}</p>
                {sealed && (
                  <Button variant="secondary" onClick={flipAll}>
                    {t("Tout retourner", "Flip all")}
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
