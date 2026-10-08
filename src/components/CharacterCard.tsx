"use client";

import Image from "next/image";
import { portraitUrl, type PlayCharacter } from "@/games/cards";
import { RARITY_LABELS } from "@/lib/economy";
import { useLocale } from "@/lib/i18n/client";

const RARITY_TONES: Record<number, string> = {
  1: "bg-straw text-ink",
  2: "bg-violet-400 text-ink",
  3: "bg-sky-400 text-ink",
  4: "bg-sea-600 text-foam",
};

/** Avis de recherche d'un personnage de la collection. `character` absent : avis pas encore obtenu. */
export function CharacterCard({
  character,
  golden = false,
  count,
  note,
  eager = false,
}: {
  character: PlayCharacter | null;
  golden?: boolean;
  count?: number;
  note?: string;
  /** Charge le portrait tout de suite : une carte qui se retourne ne doit pas attendre d'être « visible ». */
  eager?: boolean;
}) {
  const locale = useLocale();
  return (
    <div
      className={`overflow-hidden rounded-md border-4 bg-parchment text-center text-ink shadow-lg ${
        golden ? "border-straw" : "border-parchment-dark"
      }`}
    >
      <div className="relative aspect-[3/4] bg-ink/15">
        {character?.img ? (
          <Image
            src={portraitUrl(character.img)}
            alt=""
            fill
            sizes="(min-width: 640px) 180px, 45vw"
            loading={eager ? "eager" : "lazy"}
            className="object-cover object-top"
          />
        ) : (
          <span className="flex h-full items-center justify-center font-display text-6xl text-ink/30">?</span>
        )}
        {character && (
          <span
            className={`absolute top-1 left-1 rounded px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase ${RARITY_TONES[character.tier]}`}
          >
            {RARITY_LABELS[locale][character.tier]}
          </span>
        )}
        {count !== undefined && count > 1 && (
          <span className="absolute top-1 right-1 rounded bg-ink/80 px-1.5 py-0.5 text-xs font-bold text-parchment">
            ×{count}
          </span>
        )}
      </div>
      <div className="px-2 py-1.5">
        {/* Le nom est coupé quand la carte est étroite : le survol le donne en entier */}
        <p className="truncate font-display text-lg leading-tight tracking-wide" title={character?.name}>
          {character?.name ?? "· · ·"}
        </p>
        {/* La ligne est toujours réservée : deux cartes côte à côte, avec ou sans mention, ont la même hauteur */}
        <p className="h-4 truncate text-xs font-semibold">{note}</p>
      </div>
    </div>
  );
}
