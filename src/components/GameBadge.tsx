import type { GameCategoryId } from "@/lib/games/catalog";

/** Couleur de chaque catégorie de jeux : la même partout où un jeu est cité. */
export const CATEGORY_TONES: Record<GameCategoryId, { badge: string; dot: string }> = {
  oeil: { badge: "bg-[#1d4a63] text-[#8fd0f0]", dot: "bg-[#8fd0f0]" },
  oreille: { badge: "bg-[#40295f] text-[#d2b0f5]", dot: "bg-[#d2b0f5]" },
  mots: { badge: "bg-[#5a2f24] text-[#f5a88a]", dot: "bg-[#f5a88a]" },
  primes: { badge: "bg-[#1c4a44] text-[#8fe0d2]", dot: "bg-[#8fe0d2]" },
  savoir: { badge: "bg-[#2a3466] text-[#aab8ff]", dot: "bg-[#aab8ff]" },
  defis: { badge: "bg-[#5a2545] text-[#f5a3cb]", dot: "bg-[#f5a3cb]" },
};

/** Pastille d'un jeu : son initiale, à la couleur de sa catégorie. */
export function GameBadge({ title, category, className = "size-10 text-xl" }: { title: string; category: GameCategoryId; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-[10px] font-display ${CATEGORY_TONES[category].badge} ${className}`}
    >
      {title.charAt(0).toLocaleUpperCase("fr")}
    </span>
  );
}

/** Jauge en segments : un par étape, pleins pour celles qui sont franchies. */
export function Segments({ total, filled, label, className = "h-2" }: { total: number; filled: number; label: string; className?: string }) {
  return (
    <span role="img" aria-label={label} className="flex flex-1 gap-1.5">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={`flex-1 rounded-full ${className} ${index < filled ? "bg-emerald-300" : "bg-sea-700"}`} />
      ))}
    </span>
  );
}

/** Coche des éléments validés. */
export function CheckIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
