/**
 * Catalogue des mini-jeux (PLAN.md, section 4). Source unique pour l'accueil,
 * puis pour les pages /jeux/[slug] à partir de la phase 1.
 */

import type { Localized } from "@/lib/i18n";

export type GameCategoryId = "oeil" | "oreille" | "mots" | "primes" | "savoir" | "defis";

export type GameCategory = { id: GameCategoryId; title: Localized; description: Localized };

export type Game = {
  /** Identifiant du jeu et de sa page (`/jeux/<slug>`), le même dans toutes les langues. */
  slug: string;
  title: Localized;
  category: GameCategoryId;
  pitch: Localized;
  /** Lot de livraison : A = jeux phares, B = gros du catalogue, C = jeux lourds. */
  batch: "A" | "B" | "C";
  status: "soon" | "live";
};

export const GAME_CATEGORIES: GameCategory[] = [
  {
    id: "oeil",
    title: { fr: "À l'œil", en: "By Eye" },
    description: {
      fr: "Reconnaître un personnage, un pavillon ou un fruit d'un coup d'œil.",
      en: "Recognize a character, a flag or a fruit at a glance.",
    },
  },
  {
    id: "oreille",
    title: { fr: "À l'oreille", en: "By Ear" },
    description: { fr: "Un rire, une voix : qui est-ce ?", en: "A laugh, a voice: who is it?" },
  },
  {
    id: "mots",
    title: { fr: "Mots et indices", en: "Words and Clues" },
    description: { fr: "Déduire, épeler, recouper les indices.", en: "Deduce, spell, cross-check the clues." },
  },
  {
    id: "primes",
    title: { fr: "Primes et mesures", en: "Bounties and Stats" },
    description: {
      fr: "Les chiffres de l'univers : primes, tailles, âges.",
      en: "The numbers of the One Piece world: bounties, heights, ages.",
    },
  },
  {
    id: "savoir",
    title: { fr: "Savoir", en: "Knowledge" },
    description: {
      fr: "Fruits, hakis, équipages, arcs : l'encyclopédie mise à l'épreuve.",
      en: "Fruits, Haki, crews, arcs: the encyclopedia put to the test.",
    },
  },
  {
    id: "defis",
    title: { fr: "Défis", en: "Challenges" },
    description: { fr: "Les modes longs, pour ceux qui connaissent tout.", en: "The long modes, for those who know it all." },
  },
];

/** Jeux jouables. Chacun a son composant (src/games/ui/GameRunner.tsx) et sa page (src/games/content.ts). */
export const LIVE_SLUGS = [
  "onepiecedle",
  "revelation",
  "zoom-extreme",
  "avis-de-recherche",
  "plus-ou-moins",
  "le-classement",
  "type-de-fruit",
  "qui-a-mange-ce-fruit",
  "trouve-les-tous",
  // Lot B
  "memo",
  "wordle",
  "anagramme",
  "les-indices",
  "surnoms",
  "orthographe",
  "emojis",
  "devine-la-prime",
  "grand-ou-vieux",
  "premiere-apparition",
  "prime-d-equipage",
  "equipage",
  "haki",
  "techniques",
  "armes-et-sabres",
  "navires",
  "origine-et-race",
  "chronologie",
  "dans-quel-arc",
  "vrai-ou-faux",
  "mode-aleatoire",
  "duo-carre-cash",
  // Lot C : les jeux qui n'ont besoin ni d'images ni de sons nouveaux
  "rires",
  "connexions",
  "grille",
  "recrute-ton-equipage",
  "la-route-de-grand-line",
  "den-den-devin",
] as const;
export type LiveSlug = (typeof LIVE_SLUGS)[number];

/**
 * Jeux sans récompense : rien ne permet au serveur de vérifier la partie
 * (dans Den Den Devin, c'est le joueur qui dit si l'escargophone a trouvé).
 * Ils n'ont ni Berrys, ni objectifs, ni défi de la semaine.
 */
export const REWARDLESS_SLUGS: readonly LiveSlug[] = ["den-den-devin"];
export const isRewardless = (slug: string) => (REWARDLESS_SLUGS as readonly string[]).includes(slug);

export function isLiveSlug(slug: string): slug is LiveSlug {
  return (LIVE_SLUGS as readonly string[]).includes(slug);
}

const game = (slug: string, category: GameCategoryId, batch: Game["batch"], title: Localized, pitch: Localized): Game => ({
  slug,
  title,
  category,
  pitch,
  batch,
  status: isLiveSlug(slug) ? "live" : "soon",
});

export const GAMES: Game[] = [
  game("silhouette", "oeil", "A", { fr: "Silhouette", en: "Silhouette" }, { fr: "Reconnais un personnage à son ombre.", en: "Recognize a character from their shadow." }),
  game(
    "silhouette-qcm",
    "oeil",
    "B",
    { fr: "Silhouette QCM", en: "Silhouette Quiz" },
    { fr: "La même ombre, avec quatre propositions.", en: "The same shadow, with four choices." },
  ),
  game(
    "zoom-extreme",
    "oeil",
    "B",
    { fr: "Zoom extrême", en: "Extreme Zoom" },
    { fr: "Un détail très agrandi qui dézoome peu à peu.", en: "A heavily magnified detail that slowly zooms out." },
  ),
  game(
    "revelation",
    "oeil",
    "A",
    { fr: "Révélation", en: "Reveal" },
    { fr: "Une image pixelisée qui se précise avec le temps.", en: "A pixelated picture that sharpens over time." },
  ),
  game(
    "avis-de-recherche",
    "oeil",
    "A",
    { fr: "Avis de recherche", en: "Wanted Poster" },
    {
      fr: "L'affiche sans nom ni photo : la prime suffit-elle à le reconnaître ?",
      en: "The poster without a name or photo: is the bounty enough to tell who it is?",
    },
  ),
  game("jolly-roger", "oeil", "A", { fr: "Jolly Roger", en: "Jolly Roger" }, { fr: "Retrouve l'équipage à partir de son pavillon.", en: "Name the crew from its flag." }),
  game(
    "avant-apres-ellipse",
    "oeil",
    "B",
    { fr: "Avant / après l'ellipse", en: "Before / After the Timeskip" },
    { fr: "Associe chaque personnage à sa version d'avant ou d'après.", en: "Match each character with their pre- or post-timeskip look." },
  ),
  game("fruit-du-demon", "oeil", "B", { fr: "Fruit du démon", en: "Devil Fruit" }, { fr: "Reconnais un fruit à son dessin.", en: "Recognize a fruit from its drawing." }),
  game(
    "memo",
    "oeil",
    "B",
    { fr: "Mémo", en: "Memory" },
    { fr: "Des paires à retrouver : personnage et fruit, personnage et pavillon.", en: "Find the pairs: character and fruit, character and flag." },
  ),

  game(
    "rires",
    "oreille",
    "C",
    { fr: "Rires", en: "Laughs" },
    { fr: "Shishishi, Zehahaha, Kishishishi : à qui appartient ce rire ?", en: "Shishishi, Zehahaha, Kishishishi: whose laugh is it?" },
  ),
  game(
    "voix-et-repliques",
    "oreille",
    "C",
    { fr: "Voix et répliques", en: "Voices and Lines" },
    { fr: "Un court extrait, devine qui parle.", en: "A short clip: guess who is speaking." },
  ),

  game(
    "onepiecedle",
    "mots",
    "A",
    { fr: "OnePiecedle", en: "OnePiecedle" },
    {
      fr: "Le personnage mystère du jour : chaque essai te dit ce qui est juste.",
      en: "Today's mystery character: every guess tells you what you got right.",
    },
  ),
  game("wordle", "mots", "B", { fr: "Wordle", en: "Wordle" }, { fr: "Trouve un nom en six essais.", en: "Find a name in six tries." }),
  game("anagramme", "mots", "B", { fr: "Anagramme", en: "Anagram" }, { fr: "Remets les lettres d'un nom dans l'ordre.", en: "Put the letters of a name back in order." }),
  game(
    "les-indices",
    "mots",
    "B",
    { fr: "Les indices", en: "Clues" },
    { fr: "Du plus vague au plus précis : moins tu en utilises, plus tu gagnes.", en: "From vague to precise: the fewer you use, the more you earn." },
  ),
  game("qui-a-dit-ca", "mots", "B", { fr: "Qui a dit ça ?", en: "Who Said It?" }, { fr: "Attribue la citation à son auteur.", en: "Match the quote to whoever said it." }),
  game("surnoms", "mots", "B", { fr: "Surnoms", en: "Epithets" }, { fr: "« Le Chirurgien de la mort », c'est qui ?", en: "Who is the “Surgeon of Death”?" }),
  game(
    "orthographe",
    "mots",
    "B",
    { fr: "Orthographe", en: "Spelling" },
    { fr: "Écris sans faute les noms les plus retors.", en: "Spell the trickiest names without a mistake." },
  ),
  game("emojis", "mots", "B", { fr: "Emojis", en: "Emojis" }, { fr: "Un personnage ou un arc résumé en emojis.", en: "A character or an arc summed up in emojis." }),

  game(
    "plus-ou-moins",
    "primes",
    "A",
    { fr: "Plus ou moins", en: "Higher or Lower" },
    {
      fr: "Sa prime est-elle plus haute ou plus basse ? Enchaîne sans te tromper.",
      en: "Is their bounty higher or lower? Keep the streak going.",
    },
  ),
  game(
    "le-classement",
    "primes",
    "A",
    { fr: "Le classement", en: "The Ranking" },
    { fr: "Trie cinq personnages par prime, taille ou âge.", en: "Sort five characters by bounty, height or age." },
  ),
  game(
    "devine-la-prime",
    "primes",
    "B",
    { fr: "Devine la prime", en: "Guess the Bounty" },
    { fr: "Estime une prime : plus tu es proche, plus tu marques.", en: "Estimate a bounty: the closer you are, the more you score." },
  ),
  game("grand-ou-vieux", "primes", "B", { fr: "Grand ou vieux", en: "Taller or Older" }, { fr: "Qui est le plus grand ? Le plus âgé ?", en: "Who is taller? Who is older?" }),
  game(
    "premiere-apparition",
    "primes",
    "B",
    { fr: "Première apparition", en: "First Appearance" },
    { fr: "Devine le chapitre ou l'épisode d'entrée d'un personnage.", en: "Guess the chapter or episode where a character debuts." },
  ),
  game(
    "prime-d-equipage",
    "primes",
    "B",
    { fr: "Prime d'équipage", en: "Crew Bounty" },
    { fr: "Estime la prime totale d'un équipage.", en: "Estimate a crew's total bounty." },
  ),

  game("type-de-fruit", "savoir", "A", { fr: "Type de fruit", en: "Fruit Type" }, { fr: "Paramecia, Zoan ou Logia ?", en: "Paramecia, Zoan or Logia?" }),
  game(
    "qui-a-mange-ce-fruit",
    "savoir",
    "A",
    { fr: "Qui a mangé ce fruit ?", en: "Who Ate This Fruit?" },
    { fr: "Du fruit à son utilisateur, et l'inverse.", en: "From the fruit to its user, and back." },
  ),
  game(
    "equipage",
    "savoir",
    "B",
    { fr: "Équipage", en: "Crew" },
    { fr: "À quelle organisation appartient ce personnage ?", en: "Which organization does this character belong to?" },
  ),
  game("haki", "savoir", "B", { fr: "Haki", en: "Haki" }, { fr: "Quels hakis maîtrise ce personnage ?", en: "Which types of Haki does this character wield?" }),
  game("techniques", "savoir", "B", { fr: "Techniques", en: "Techniques" }, { fr: "À qui appartient cette attaque ?", en: "Whose attack is this?" }),
  game("armes-et-sabres", "savoir", "B", { fr: "Armes et sabres", en: "Weapons and Swords" }, { fr: "Du sabre à son porteur.", en: "From the blade to its wielder." }),
  game("navires", "savoir", "B", { fr: "Navires", en: "Ships" }, { fr: "Du navire à son équipage.", en: "From the ship to its crew." }),
  game(
    "origine-et-race",
    "savoir",
    "B",
    { fr: "Origine et race", en: "Origin and Race" },
    { fr: "Mer d'origine, race : d'où vient-il ?", en: "Home sea, race: where are they from?" },
  ),
  game(
    "chronologie",
    "savoir",
    "B",
    { fr: "Chronologie", en: "Timeline" },
    { fr: "Remets des arcs ou des événements dans l'ordre.", en: "Put arcs or events back in order." },
  ),
  game("dans-quel-arc", "savoir", "B", { fr: "Dans quel arc ?", en: "Which Arc?" }, { fr: "Situe un personnage ou un événement.", en: "Place a character or an event." }),
  game(
    "vrai-ou-faux",
    "savoir",
    "B",
    { fr: "Vrai ou faux", en: "True or False" },
    { fr: "Des affirmations à trancher, sans réfléchir trop longtemps.", en: "Statements to settle, without overthinking." },
  ),

  game(
    "mode-aleatoire",
    "defis",
    "B",
    { fr: "Mode aléatoire", en: "Random Mode" },
    { fr: "Un enchaînement de manches tirées dans tous les jeux.", en: "A run of rounds drawn from every game." },
  ),
  game(
    "duo-carre-cash",
    "defis",
    "B",
    { fr: "Duo, Carré ou Cash", en: "Duo, Quad or Cash" },
    {
      fr: "Deux propositions, quatre, ou aucune : choisis ton risque à chaque question.",
      en: "Two choices, four, or none: pick your risk on every question.",
    },
  ),
  game(
    "trouve-les-tous",
    "defis",
    "A",
    { fr: "Trouve-les tous", en: "Find Them All" },
    { fr: "Cite tous les membres d'un groupe avant la fin du chrono.", en: "Name every member of a group before time runs out." },
  ),
  game(
    "la-route-de-grand-line",
    "defis",
    "C",
    { fr: "La Route de Grand Line", en: "The Grand Line Route" },
    { fr: "D'île en île, de plus en plus dur, un boss par arc.", en: "Island after island, harder and harder, with a boss every arc." },
  ),
  game(
    "den-den-devin",
    "defis",
    "C",
    { fr: "Den Den Devin", en: "Den Den Oracle" },
    { fr: "Pense à un personnage : l'escargophone le devine.", en: "Think of a character: the Transponder Snail guesses who." },
  ),
  game("geopiece", "defis", "C", { fr: "GeoPiece", en: "GeoPiece" }, { fr: "Place une île sur la carte du monde.", en: "Pin an island on the world map." }),
  game("grille", "defis", "C", { fr: "Grille 3×3", en: "3×3 Grid" }, { fr: "Remplis la grille en croisant deux critères.", en: "Fill the grid by crossing two criteria." }),
  game(
    "connexions",
    "defis",
    "C",
    { fr: "Connexions", en: "Connections" },
    { fr: "Seize personnages, quatre familles cachées.", en: "Sixteen characters, four hidden groups." },
  ),
  game(
    "recrute-ton-equipage",
    "defis",
    "C",
    { fr: "Recrute ton équipage", en: "Recruit Your Crew" },
    {
      fr: "Un tirage au hasard, dix postes à pourvoir : compose le meilleur équipage.",
      en: "A random draw, ten posts to fill: build the best crew.",
    },
  ),
];

export function getGame(slug: string): Game | undefined {
  return GAMES.find((g) => g.slug === slug);
}
