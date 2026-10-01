/**
 * Libellés français des valeurs codées du jeu de données, et traduction des
 * affiliations (que le wiki fournit en anglais).
 */
import type { Character, FruitType, Race, Sea } from "./schema";

export const SEA_LABELS: Record<Sea, string> = {
  "east-blue": "East Blue",
  "west-blue": "West Blue",
  "north-blue": "North Blue",
  "south-blue": "South Blue",
  "grand-line": "Grand Line",
  "calm-belt": "Calm Belt",
  "red-line": "Red Line",
  sky: "Îles célestes",
};

export const RACE_LABELS: Record<Race, string> = {
  human: "Humain",
  giant: "Géant",
  fishman: "Homme-poisson",
  merfolk: "Sirène",
  mink: "Mink",
  dwarf: "Nain",
  cyborg: "Cyborg",
  lunarian: "Lunaria",
  buccaneer: "Boucanier",
  skypiean: "Peuple du ciel",
  longarm: "Longs-bras",
  longleg: "Longues-jambes",
  snakeneck: "Long-cou",
  homie: "Homie",
  clone: "Clone",
  animal: "Animal",
};

export const FRUIT_TYPE_LABELS: Record<FruitType, string> = {
  paramecia: "Paramecia",
  logia: "Logia",
  zoan: "Zoan",
  "zoan-ancient": "Zoan antique",
  "zoan-mythical": "Zoan mythique",
  smile: "SMILE",
  artificial: "Artificiel",
};

/** Libellé d'une combinaison de hakis, pour l'affichage et les quiz. */
export function hakiLabel(haki: readonly HakiType[]): string {
  if (haki.length === 0) return "Aucun";
  if (haki.length === 3) return "Les trois";
  return haki.map((type) => HAKI_LABELS[type]).join(" et ");
}

export const HAKI_LABELS = {
  observation: "Observation",
  armament: "Armement",
  conqueror: "Rois",
} as const;
export type HakiType = keyof typeof HAKI_LABELS;

/** Affiliations du wiki (en anglais) → libellé français. */
const AFFILIATION_FR: Record<string, string> = {
  "Straw Hat Pirates": "Équipage du Chapeau de paille",
  "Straw Hat Grand Fleet": "Grande Flotte du Chapeau de paille",
  "Fake Straw Hat Crew": "Faux équipage du Chapeau de paille",
  Marines: "Marine",
  "World Government": "Gouvernement mondial",
  "Five Elders": "Cinq Doyens",
  "Knights of God": "Chevaliers divins",
  "Cipher Pol": "Cipher Pol",
  "Impel Down": "Impel Down",
  "Revolutionary Army": "Armée révolutionnaire",
  "Seven Warlords of the Sea": "Grands Corsaires",
  "Charlotte Family": "Famille Charlotte",
  "Big Mom Pirates": "Équipage de Big Mom",
  "Beasts Pirates": "Équipage aux Cent Bêtes",
  "Whitebeard Pirates": "Équipage de Barbe Blanche",
  "Blackbeard Pirates": "Équipage de Barbe Noire",
  "Red Hair Pirates": "Équipage du Roux",
  "Roger Pirates": "Équipage de Roger",
  "Rocks Pirates": "Équipage de Rocks",
  "Cross Guild": "Cross Guild",
  "Buggy Pirates": "Équipage de Baggy",
  "Donquixote Pirates": "Équipage de Don Quijote",
  "Heart Pirates": "Équipage du Heart",
  "Kid Pirates": "Équipage de Kidd",
  "Fire Tank Pirates": "Équipage du Fire Tank",
  "Bonney Pirates": "Équipage de Bonney",
  "Hawkins Pirates": "Équipage de Hawkins",
  "On Air Pirates": "Équipage du On Air",
  "Fallen Monk Pirates": "Équipage des Moines dépravés",
  "Kuja Pirates": "Équipage des Kuja",
  "Thriller Bark Pirates": "Équipage de Thriller Bark",
  "Sun Pirates": "Équipage du Soleil",
  "Arlong Pirates": "Équipage d'Arlong",
  "New Fish-Man Pirates": "Nouvel équipage des Hommes-Poissons",
  "Flying Pirates": "Équipage du Hollandais volant",
  "Black Cat Pirates": "Équipage du Chat noir",
  "Krieg Pirates": "Équipage de Krieg",
  "Foxy Pirates": "Équipage de Foxy",
  "Bellamy Pirates": "Équipage de Bellamy",
  "Spade Pirates": "Équipage du Spade",
  "Rumbar Pirates": "Équipage du Rumbar",
  "Giant Warrior Pirates": "Équipage des Géants guerriers",
  "New Giant Warrior Pirates": "Nouvel équipage des Géants guerriers",
  "Golden Lion Pirates": "Équipage du Lion d'or",
  "Beautiful Pirates": "Équipage du Beau Pirate",
  "Caribou Pirates": "Équipage de Caribou",
  "Bluejam Pirates": "Équipage de Bluejam",
  "Bliking Pirates": "Équipage de Wapol",
  "Ideo Pirates": "Équipage d'Ideo",
  "Rolling Pirates": "Équipage de Lola",
  "Barto Club": "Barto Club",
  "Happo Navy": "Flotte Happo",
  "Baroque Works": "Baroque Works",
  "New Spiders Cafe": "Baroque Works",
  "Galley-La Company": "Galley-La Company",
  "Franky Family": "Franky Family",
  "Tom's Workers": "Tom's Workers",
  Baratie: "Baratie",
  "Dadan Family": "Famille Dadan",
  "Kouzuki Family": "Famille Kozuki",
  "Kurozumi Family": "Famille Kurozumi",
  "Shimotsuki Family": "Famille Shimotsuki",
  "Vinsmoke Family": "Famille Vinsmoke",
  "Neptune Family": "Famille Neptune",
  "Riku Family": "Famille Riku",
  "Elbaph Royal Family": "Famille royale d'Elbaf",
  "Wano Country": "Pays des Wa",
  "Mokomo Dukedom": "Duché de Mokomo",
  "Arabasta Kingdom": "Royaume d'Alabasta",
  Arabasta: "Royaume d'Alabasta",
  "Ryugu Kingdom": "Royaume Ryugu",
  "Tontatta Kingdom": "Royaume de Tontatta",
  "Sakura Kingdom": "Royaume de Sakura",
  "Evil Black Drum Kingdom": "Royaume de Drum noir",
  "Kamabakka Kingdom": "Royaume de Kamabakka",
  "Goa Kingdom": "Royaume de Goa",
  "Lvneel Kingdom": "Royaume de Lvneel",
  Dressrosa: "Dressrosa",
  Skypiea: "Skypiea",
  Shandia: "Shandias",
  "God's Army": "Armée de Dieu",
  Elbaph: "Elbaf",
  "Ohara Archaeologists": "Archéologues d'Ohara",
  "Ninja-Pirate-Mink-Samurai Alliance": "Alliance des ninjas, pirates, minks et samouraïs",
  "Super Spot-Billed Duck Troops": "Escadron des Super-Canards",
  Seraphim: "Séraphins",
  Pacifista: "Pacifistas",
  MADS: "MADS",
  "NEO MADS": "NEO MADS",
  "Clan of D.": "Clan des D.",
  "Four Emperors": "Quatre Empereurs",
  "Worst Generation": "Pire Génération",
};

/** Statuts et alliances : jamais l'affiliation principale si le personnage en a une autre. */
const SECONDARY_AFFILIATIONS = new Set([
  "Clan of D.",
  "Four Emperors",
  "Seven Warlords of the Sea",
  "Worst Generation",
  "Straw Hat Grand Fleet",
  "Ninja-Pirate-Mink-Samurai Alliance",
  "Seraphim",
]);

/** Affiliation principale imposée quand l'ordre du wiki donne un résultat trompeur. */
export const MAIN_AFFILIATION_OVERRIDES: Record<string, string> = {
  "page-one": "Beasts Pirates",
  ulti: "Beasts Pirates",
  stussy: "Cipher Pol",
  "bartholomew-kuma": "Revolutionary Army",
  vegapunk: "World Government",
  "caesar-clown": "MADS",
  enel: "God's Army",
  izou: "Whitebeard Pirates",
  yamato: "Wano Country",
  "kurozumi-tama": "Wano Country",
  "ashura-doji": "Kouzuki Family",
  "kurozumi-kanjuro": "Kurozumi Family",
  rebecca: "Riku Family",
  monet: "Donquixote Pirates",
  bentham: "Baroque Works",
  igaram: "Arabasta Kingdom",
  karoo: "Arabasta Kingdom",
  camie: "Ryugu Kingdom",
  hatchan: "Arlong Pirates",
  kashii: "Giant Warrior Pirates",
  "jaguar-d-saul": "Marines",
  "mont-blanc-noland": "Lvneel Kingdom",
};

/** Le wiki détaille parfois l'unité (« Marines, G-5 », « CP9 ») : on remonte à l'organisation. */
export function organizationOf(name: string): string {
  const base = name
    .replace(/^(Ally|Subordinates?) of the /, "")
    .split(",")[0]
    .trim();
  if (/^Marines?\b/.test(base)) return "Marines";
  if (/^CP-?\d|^CP-?0|^Cipher Pol/.test(base)) return "Cipher Pol";
  return base;
}

export function translateAffiliation(name: string): string {
  if (AFFILIATION_FR[name]) return AFFILIATION_FR[name];
  const of = (owner: string) => (/^[AEIOUYH]/i.test(owner) ? `d'${owner}` : `de ${owner}`);
  const pirates = name.match(/^(.+) Pirates$/);
  if (pirates) return `Équipage ${of(pirates[1])}`;
  const kingdom = name.match(/^(.+) Kingdom$/);
  if (kingdom) return `Royaume ${of(kingdom[1])}`;
  const family = name.match(/^(.+) Family$/);
  if (family) return `Famille ${family[1]}`;
  return name;
}

/**
 * Affiliation principale d'un personnage, en français : la première qu'il n'a
 * pas quittée, ou à défaut la première tout court (personnages décédés).
 * À appeler sur une vue filtrée (`viewCharacter`) pour respecter les spoilers.
 */
export function mainAffiliation(character: Pick<Character, "id" | "affiliations">): string | null {
  const forced = MAIN_AFFILIATION_OVERRIDES[character.id];
  if (forced) return translateAffiliation(forced);

  const primary = character.affiliations.filter((a) => !SECONDARY_AFFILIATIONS.has(organizationOf(a.name)));
  const pool = primary.length ? primary : character.affiliations;
  const chosen = pool.find((a) => !a.former) ?? pool[0];
  return chosen ? translateAffiliation(organizationOf(chosen.name)) : null;
}
