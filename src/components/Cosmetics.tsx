"use client";

/** Dessin des cosmétiques : pavillon, navire, cadre d'avis de recherche, titre. Leur liste et leurs prix sont dans `src/lib/economy/cosmetics.ts`. */
import { getCosmetic, type PlayerLook } from "@/lib/economy";
import { useLocale } from "@/lib/i18n/client";

type FlagStyle = { field: string; emblem: string; mark?: "sabres" | "crown" };

const DEFAULT_FLAG: FlagStyle = { field: "#17130f", emblem: "#f6ecd6" };
const FLAGS: Record<string, FlagStyle> = {
  "flag-rouge": { field: "#a81b2e", emblem: "#f6ecd6" },
  "flag-azur": { field: "#1f5fa8", emblem: "#f6ecd6" },
  "flag-sabres": { field: "#17130f", emblem: "#f6ecd6", mark: "sabres" },
  "flag-couronne": { field: "#4a2a7a", emblem: "#f6ecd6", mark: "crown" },
  "flag-or": { field: "#f2c14e", emblem: "#2b2118" },
};
const flagStyle = (id: string | null | undefined) => (id && FLAGS[id]) || DEFAULT_FLAG;

/** Pavillon : une tête de mort sur un fond, avec des os, des sabres ou une couronne selon le modèle. `id` absent : le pavillon noir d'origine. */
export function FlagArt({ id, className = "h-8 w-12" }: { id?: string | null; className?: string }) {
  const { field, emblem, mark } = flagStyle(id);
  return (
    <svg viewBox="0 0 48 32" aria-hidden="true" className={`shrink-0 rounded-[3px] ${className}`}>
      <rect width="48" height="32" fill={field} />
      {mark === "sabres" ? (
        <g stroke={emblem} strokeLinecap="round" fill="none">
          <path d="M11 27 Q22 18 37 5" strokeWidth="2" />
          <path d="M37 27 Q26 18 11 5" strokeWidth="2" />
          <path d="M12 22l5 4M36 22l-5 4" strokeWidth="2.5" />
        </g>
      ) : (
        <g stroke={emblem} strokeWidth="3.2" strokeLinecap="round">
          <path d="M12 6l24 20M36 6L12 26" />
        </g>
      )}
      <circle cx="24" cy="14" r="7.5" fill={emblem} />
      <rect x="19.5" y="18" width="9" height="6.5" rx="2" fill={emblem} />
      <circle cx="21" cy="14" r="2" fill={field} />
      <circle cx="27" cy="14" r="2" fill={field} />
      <path d="M22.5 22v2.5M25.5 22v2.5" stroke={field} strokeWidth="1" />
      {mark === "crown" && <path d="M17 7.5l2.5-5 4.5 3.5 4.5-3.5 2.5 5z" fill="#f2c14e" stroke={field} strokeWidth="0.6" />}
    </svg>
  );
}

type ShipStyle = { hull: string; masts: { x: number; top: number; sails: number }[]; jib?: boolean };

const DEFAULT_SHIP: ShipStyle = { hull: "M34 62H88L81 76H41Z", masts: [{ x: 61, top: 30, sails: 1 }] };
const SHIPS: Record<string, ShipStyle> = {
  "ship-caravelle": { hull: "M24 60H98L89 78H33Z", masts: [{ x: 62, top: 16, sails: 2 }], jib: true },
  "ship-brigantin": {
    hull: "M16 60H106L95 78H27Z",
    masts: [
      { x: 46, top: 22, sails: 2 },
      { x: 78, top: 12, sails: 2 },
    ],
    jib: true,
  },
  "ship-galion": {
    hull: "M8 52H24V60H96V48H114L102 80H22Z",
    masts: [
      { x: 38, top: 22, sails: 2 },
      { x: 62, top: 6, sails: 3 },
      { x: 86, top: 18, sails: 2 },
    ],
    jib: true,
  },
};

/** Voiles d'un mât, de plus en plus larges vers le pont. */
function sails(mast: ShipStyle["masts"][number], deck: number): string[] {
  const height = (deck - 4 - (mast.top + 5)) / mast.sails - 2;
  return Array.from({ length: mast.sails }, (_, index) => {
    const y = mast.top + 5 + index * (height + 2);
    const half = 8 + index * 3 + (mast.sails === 1 ? 4 : 0);
    return `M${mast.x - half} ${y}Q${mast.x} ${y + 3} ${mast.x + half} ${y}L${mast.x + half + 2} ${y + height}Q${mast.x} ${y + height + 3} ${mast.x - half - 2} ${y + height}Z`;
  });
}

/** Navire du joueur, son pavillon en tête de mât. `id` absent : la barque d'origine. */
export function ShipArt({ id, flag, className = "h-[90px] w-[120px]" }: { id?: string | null; flag?: string | null; className?: string }) {
  const ship = (id && SHIPS[id]) || DEFAULT_SHIP;
  const deck = 60;
  const main = ship.masts.reduce((tallest, mast) => (mast.top < tallest.top ? mast : tallest));
  return (
    <svg viewBox="0 0 120 90" aria-hidden="true" className={`shrink-0 ${className}`}>
      {ship.masts.map((mast) => (
        <g key={mast.x}>
          <path d={`M${mast.x} ${mast.top}V${deck}`} stroke="#5a3a22" strokeWidth="2" />
          {sails(mast, deck).map((path) => (
            <path key={path} d={path} fill="#f6ecd6" stroke="#c9b98f" strokeWidth="0.8" />
          ))}
        </g>
      ))}
      {ship.jib && <path d={`M${ship.masts[0].x - 4} ${ship.masts[0].top + 8}L${ship.masts[0].x - 26} ${deck - 2}H${ship.masts[0].x - 4}Z`} fill="#e3d2a9" />}
      <rect x={main.x} y={main.top - 1} width="11" height="7" fill={flagStyle(flag).field} stroke="#f6ecd6" strokeWidth="0.6" />
      <path d={ship.hull} fill="#7a4a2a" />
      <path d={ship.hull} fill="none" stroke="#f2c14e" strokeWidth="1.2" opacity="0.7" />
      <path d="M0 80Q15 74 30 80T60 80T90 80T120 80V90H0Z" fill="#2a5380" opacity="0.9" />
    </svg>
  );
}

/** Bordure de l'avis de recherche du joueur, selon son cadre. */
const FRAMES: Record<string, string> = {
  "frame-marine": "border-[#1f4f8f] shadow-[0_0_0_2px_#e8f1fa]",
  "frame-revolution": "border-[#7a1c1c] shadow-[0_0_0_2px_#2b2118]",
  "frame-emeraude": "border-[#1f7a5a] shadow-[0_0_0_2px_#8fe0d2]",
  "frame-or": "border-straw shadow-[0_0_0_2px_#c9972a]",
  "frame-empereur": "border-[#4a2a7a] shadow-[0_0_0_3px_#f2c14e]",
};
export const frameClass = (id: string | null | undefined) => (id && FRAMES[id]) || "border-parchment-dark";

/** Aperçu d'un cadre : un petit avis de recherche vide. */
export function FrameArt({ id, className = "h-16 w-12" }: { id?: string | null; className?: string }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 flex-col items-center gap-1 rounded-[5px] border-[3px] bg-parchment p-1 ${frameClass(id)} ${className}`}>
      <span className="w-full flex-1 bg-[#d9c9a0]" />
      <span className="h-1 w-4/5 rounded-full bg-ink/40" />
    </span>
  );
}

export function useCosmeticName(): (id: string | null | undefined) => string | null {
  const locale = useLocale();
  return (id) => (id ? (getCosmetic(id)?.name[locale] ?? null) : null);
}

/** Un joueur dans un classement : son pavillon, son pseudo et, s'il en porte un, son titre. */
export function PlayerTag({ name, look, you = false }: { name: string; look: PlayerLook; you?: boolean }) {
  const title = useCosmeticName()(look.title);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <FlagArt id={look.flag} className="h-5 w-[30px]" />
      <span className="min-w-0">
        <span className={`block truncate font-extrabold ${you ? "text-straw" : "text-foam"}`}>{name}</span>
        {title && <span className="block truncate text-xs text-mist">{title}</span>}
      </span>
    </span>
  );
}
