/**
 * Cosmétiques : cadre de l'avis de recherche du joueur, pavillon, navire et
 * titre. Ils ne changent rien au jeu ; ils s'achètent en Berrys à la boutique,
 * ou se gagnent en classé et en raid. Calcul pur, comme le reste de l'économie.
 */
import type { Localized } from "@/lib/i18n";
import type { PlayerState } from "./types";

export const COSMETIC_SLOTS = ["frame", "flag", "ship", "title"] as const;
export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];

export const COSMETIC_SLOT_LABELS: Record<CosmeticSlot, Localized> = {
  frame: { fr: "Cadres d'avis de recherche", en: "Wanted poster frames" },
  flag: { fr: "Pavillons", en: "Flags" },
  ship: { fr: "Navires", en: "Ships" },
  title: { fr: "Titres", en: "Titles" },
};

/** Ce que le joueur a sans rien acheter, et qu'il retrouve en retirant un cosmétique. */
export const COSMETIC_DEFAULTS: Record<CosmeticSlot, Localized> = {
  frame: { fr: "Cadre d'origine", en: "Original frame" },
  flag: { fr: "Pavillon noir", en: "Black flag" },
  ship: { fr: "Barque", en: "Dinghy" },
  title: { fr: "Sans titre", en: "No title" },
};

export type Cosmetic = {
  id: string;
  slot: CosmeticSlot;
  name: Localized;
  /** Prix à la boutique ; `null` pour un cosmétique qui ne s'achète pas. */
  price: number | null;
  /** Pour un cosmétique qui ne s'achète pas : comment on l'obtient. */
  earned?: Localized;
};

export const COSMETICS: readonly Cosmetic[] = [
  { id: "frame-marine", slot: "frame", name: { fr: "Cadre de la Marine", en: "Navy frame" }, price: 4000 },
  { id: "frame-revolution", slot: "frame", name: { fr: "Cadre révolutionnaire", en: "Revolutionary frame" }, price: 4000 },
  { id: "frame-emeraude", slot: "frame", name: { fr: "Cadre émeraude", en: "Emerald frame" }, price: 6000 },
  { id: "frame-or", slot: "frame", name: { fr: "Cadre doré", en: "Golden frame" }, price: 15_000 },
  { id: "frame-empereur", slot: "frame", name: { fr: "Cadre d'Empereur", en: "Emperor frame" }, price: 30_000 },

  { id: "flag-rouge", slot: "flag", name: { fr: "Pavillon rouge", en: "Red flag" }, price: 3000 },
  { id: "flag-azur", slot: "flag", name: { fr: "Pavillon azur", en: "Azure flag" }, price: 3000 },
  { id: "flag-sabres", slot: "flag", name: { fr: "Pavillon aux sabres", en: "Crossed sabers flag" }, price: 6000 },
  { id: "flag-couronne", slot: "flag", name: { fr: "Pavillon couronné", en: "Crowned flag" }, price: 10_000 },
  { id: "flag-or", slot: "flag", name: { fr: "Pavillon d'or", en: "Golden flag" }, price: 20_000 },

  { id: "ship-caravelle", slot: "ship", name: { fr: "Caravelle", en: "Caravel" }, price: 6000 },
  { id: "ship-brigantin", slot: "ship", name: { fr: "Brigantin", en: "Brigantine" }, price: 14_000 },
  { id: "ship-galion", slot: "ship", name: { fr: "Galion", en: "Galleon" }, price: 30_000 },

  { id: "title-chasseur", slot: "title", name: { fr: "Chasseur de primes", en: "Bounty Hunter" }, price: 3000 },
  { id: "title-gourmet", slot: "title", name: { fr: "Gourmet des mers", en: "Gourmet of the Seas" }, price: 3000 },
  { id: "title-archeologue", slot: "title", name: { fr: "Lecteur de ponéglyphes", en: "Poneglyph Reader" }, price: 8000 },
  { id: "title-roi-des-quiz", slot: "title", name: { fr: "Roi des quiz", en: "Quiz King" }, price: 15_000 },
  { id: "title-futur-roi", slot: "title", name: { fr: "Futur roi des pirates", en: "Future King of the Pirates" }, price: 40_000 },
  {
    id: "title-nouveau-monde",
    slot: "title",
    name: { fr: "Vétéran du Nouveau Monde", en: "New World Veteran" },
    price: null,
    earned: { fr: "Finir une saison classée en ligue Nouveau Monde", en: "Finish a ranked season in the New World league" },
  },
  {
    id: "title-laugh-tale",
    slot: "title",
    name: { fr: "Légende de Laugh Tale", en: "Legend of Laugh Tale" },
    price: null,
    earned: { fr: "Finir une saison classée en ligue Laugh Tale", en: "Finish a ranked season in the Laugh Tale league" },
  },
  {
    id: "title-fleau",
    slot: "title",
    name: { fr: "Fléau des Empereurs", en: "Scourge of the Emperors" },
    price: null,
    earned: { fr: "Finir dans les trois premiers d'un raid vaincu", en: "Finish in the top three of a defeated raid" },
  },
];

const BY_ID = new Map(COSMETICS.map((cosmetic) => [cosmetic.id, cosmetic]));
export const getCosmetic = (id: string): Cosmetic | undefined => BY_ID.get(id);

/** Cosmétiques d'un joueur : ceux qu'il possède, et celui qu'il porte à chaque emplacement. */
export type CosmeticsState = { owned: string[]; equipped: Partial<Record<CosmeticSlot, string>> };
/** Ce que les autres joueurs voient de lui : les cosmétiques qu'il porte. */
export type PlayerLook = Partial<Record<CosmeticSlot, string>>;

export const NO_COSMETICS: CosmeticsState = { owned: [], equipped: {} };

/**
 * Ne garde d'une liste et d'une tenue que ce qui existe : des cosmétiques
 * connus, portés à leur emplacement, et seulement s'ils sont possédés. Sert à
 * relire ce qui vient de la base ou du navigateur.
 */
export function sanitizeCosmetics(owned: unknown, equipped: unknown): CosmeticsState {
  const ids = Array.isArray(owned) ? [...new Set(owned.filter((id): id is string => typeof id === "string" && BY_ID.has(id)))] : [];
  const worn: CosmeticsState["equipped"] = {};
  if (typeof equipped === "object" && equipped !== null) {
    for (const slot of COSMETIC_SLOTS) {
      const id = (equipped as Record<string, unknown>)[slot];
      if (typeof id === "string" && ids.includes(id) && BY_ID.get(id)?.slot === slot) worn[slot] = id;
    }
  }
  return { owned: ids, equipped: worn };
}

export type CosmeticError = "unknown" | "owned" | "locked" | "insufficient" | "not-owned";

/** Achat à la boutique : le prix est fixe, les bonus d'équipage n'y changent rien. */
export function buyCosmetic(state: PlayerState, id: string): { state: PlayerState; cost: number } | CosmeticError {
  const cosmetic = BY_ID.get(id);
  if (!cosmetic) return "unknown";
  if (state.cosmetics.owned.includes(id)) return "owned";
  if (cosmetic.price === null) return "locked";
  if (state.berrys < cosmetic.price) return "insufficient";
  return {
    state: {
      ...state,
      berrys: state.berrys - cosmetic.price,
      // Un cosmétique acheté est porté tout de suite : c'est pour cela qu'on l'achète
      cosmetics: { owned: [...state.cosmetics.owned, id], equipped: { ...state.cosmetics.equipped, [cosmetic.slot]: id } },
    },
    cost: cosmetic.price,
  };
}

/** Porte un cosmétique possédé, ou revient à l'apparence d'origine de l'emplacement (`null`). */
export function equipCosmetic(state: PlayerState, slot: string, id: string | null): PlayerState | CosmeticError {
  if (!(COSMETIC_SLOTS as readonly string[]).includes(slot)) return "unknown";
  const equipped = { ...state.cosmetics.equipped };
  if (id === null) {
    delete equipped[slot as CosmeticSlot];
  } else {
    if (BY_ID.get(id)?.slot !== slot) return "unknown";
    if (!state.cosmetics.owned.includes(id)) return "not-owned";
    equipped[slot as CosmeticSlot] = id;
  }
  return { ...state, cosmetics: { ...state.cosmetics, equipped } };
}

/** Ajoute un cosmétique gagné (classé, raid) à ceux du joueur, sans le lui faire porter. */
export function grantCosmetic(cosmetics: CosmeticsState, id: string): CosmeticsState {
  if (!BY_ID.has(id) || cosmetics.owned.includes(id)) return cosmetics;
  return { ...cosmetics, owned: [...cosmetics.owned, id] };
}
