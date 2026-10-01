/**
 * Catalogue des mini-jeux (PLAN.md, section 4). Source unique pour l'accueil,
 * puis pour les pages /jeux/[slug] à partir de la phase 1.
 */

export type GameCategoryId = "oeil" | "oreille" | "mots" | "primes" | "savoir" | "defis";

export type GameCategory = { id: GameCategoryId; title: string; description: string };

export type Game = {
  slug: string;
  title: string;
  category: GameCategoryId;
  pitch: string;
  /** Lot de livraison : A = jeux phares, B = gros du catalogue, C = jeux lourds. */
  batch: "A" | "B" | "C";
  status: "soon" | "live";
};

export const GAME_CATEGORIES: GameCategory[] = [
  { id: "oeil", title: "À l'œil", description: "Reconnaître un personnage, un pavillon ou un fruit d'un coup d'œil." },
  { id: "oreille", title: "À l'oreille", description: "Un rire, une voix : qui est-ce ?" },
  { id: "mots", title: "Mots et indices", description: "Déduire, épeler, recouper les indices." },
  { id: "primes", title: "Primes et mesures", description: "Les chiffres de l'univers : primes, tailles, âges." },
  { id: "savoir", title: "Savoir", description: "Fruits, hakis, équipages, arcs : l'encyclopédie mise à l'épreuve." },
  { id: "defis", title: "Défis", description: "Les modes longs, pour ceux qui connaissent tout." },
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
] as const;
export type LiveSlug = (typeof LIVE_SLUGS)[number];

export function isLiveSlug(slug: string): slug is LiveSlug {
  return (LIVE_SLUGS as readonly string[]).includes(slug);
}

const game = (
  slug: string,
  title: string,
  category: GameCategoryId,
  batch: Game["batch"],
  pitch: string,
): Game => ({ slug, title, category, batch, pitch, status: isLiveSlug(slug) ? "live" : "soon" });

export const GAMES: Game[] = [
  game("silhouette", "Silhouette", "oeil", "A", "Reconnais un personnage à son ombre."),
  game("silhouette-qcm", "Silhouette QCM", "oeil", "B", "La même ombre, avec quatre propositions."),
  game("zoom-extreme", "Zoom extrême", "oeil", "B", "Un détail très agrandi qui dézoome peu à peu."),
  game("revelation", "Révélation", "oeil", "A", "Une image pixelisée qui se précise avec le temps."),
  game("avis-de-recherche", "Avis de recherche", "oeil", "A", "L'affiche sans nom ni photo : la prime suffit-elle à le reconnaître ?"),
  game("jolly-roger", "Jolly Roger", "oeil", "A", "Retrouve l'équipage à partir de son pavillon."),
  game("avant-apres-ellipse", "Avant / après l'ellipse", "oeil", "B", "Associe chaque personnage à sa version d'avant ou d'après."),
  game("fruit-du-demon", "Fruit du démon", "oeil", "B", "Reconnais un fruit à son dessin."),
  game("memo", "Mémo", "oeil", "B", "Des paires à retrouver : personnage et fruit, personnage et pavillon."),

  game("rires", "Rires", "oreille", "C", "Shishishi, Zehahaha, Kishishishi : à qui est ce rire ?"),
  game("voix-et-repliques", "Voix et répliques", "oreille", "C", "Un court extrait, devine qui parle."),

  game("onepiecedle", "OnePiecedle", "mots", "A", "Le personnage mystère du jour : chaque essai te dit ce qui est juste."),
  game("wordle", "Wordle", "mots", "B", "Trouve un nom en six essais."),
  game("anagramme", "Anagramme", "mots", "B", "Remets les lettres d'un nom dans l'ordre."),
  game("les-indices", "Les indices", "mots", "B", "Du plus vague au plus précis : moins tu en utilises, plus tu gagnes."),
  game("qui-a-dit-ca", "Qui a dit ça ?", "mots", "B", "Attribue la citation à son auteur."),
  game("surnoms", "Surnoms", "mots", "B", "« Le Chirurgien de la mort », c'est qui ?"),
  game("orthographe", "Orthographe", "mots", "B", "Écris sans faute les noms les plus retors."),
  game("emojis", "Emojis", "mots", "B", "Un personnage ou un arc résumé en emojis."),

  game("plus-ou-moins", "Plus ou moins", "primes", "A", "Sa prime est-elle plus haute ou plus basse ? Enchaîne sans te tromper."),
  game("le-classement", "Le classement", "primes", "A", "Trie cinq personnages par prime, taille ou âge."),
  game("devine-la-prime", "Devine la prime", "primes", "B", "Estime une prime : plus tu es proche, plus tu marques."),
  game("grand-ou-vieux", "Grand ou vieux", "primes", "B", "Qui est le plus grand ? Le plus âgé ?"),
  game("premiere-apparition", "Première apparition", "primes", "B", "Devine le chapitre ou l'épisode d'entrée d'un personnage."),
  game("prime-d-equipage", "Prime d'équipage", "primes", "B", "Estime la prime totale d'un équipage."),

  game("type-de-fruit", "Type de fruit", "savoir", "A", "Paramecia, Zoan ou Logia ?"),
  game("qui-a-mange-ce-fruit", "Qui a mangé ce fruit ?", "savoir", "A", "Du fruit à son utilisateur, et l'inverse."),
  game("equipage", "Équipage", "savoir", "B", "À quelle organisation appartient ce personnage ?"),
  game("haki", "Haki", "savoir", "B", "Quels hakis maîtrise ce personnage ?"),
  game("techniques", "Techniques", "savoir", "B", "À qui appartient cette attaque ?"),
  game("armes-et-sabres", "Armes et sabres", "savoir", "B", "Du sabre à son porteur."),
  game("navires", "Navires", "savoir", "B", "Du navire à son équipage."),
  game("origine-et-race", "Origine et race", "savoir", "B", "Mer d'origine, race : d'où vient-il ?"),
  game("chronologie", "Chronologie", "savoir", "B", "Remets des arcs ou des événements dans l'ordre."),
  game("dans-quel-arc", "Dans quel arc ?", "savoir", "B", "Situe un personnage ou un événement."),
  game("vrai-ou-faux", "Vrai ou faux", "savoir", "B", "Des affirmations à trancher, sans réfléchir trop longtemps."),

  game("mode-aleatoire", "Mode aléatoire", "defis", "B", "Un enchaînement de manches tirées dans tous les jeux."),
  game("duo-carre-cash", "Duo, Carré ou Cash", "defis", "B", "Deux propositions, quatre, ou aucune : choisis ton risque à chaque question."),
  game("trouve-les-tous", "Trouve-les tous", "defis", "A", "Cite tous les membres d'un groupe avant la fin du chrono."),
  game("la-route-de-grand-line", "La Route de Grand Line", "defis", "C", "D'île en île, de plus en plus dur, un boss par arc."),
  game("den-den-devin", "Den Den Devin", "defis", "C", "Pense à un personnage : l'escargophone le devine."),
  game("geopiece", "GeoPiece", "defis", "C", "Place une île sur la carte du monde."),
  game("grille", "Grille 3×3", "defis", "C", "Remplis la grille en croisant deux critères."),
  game("connexions", "Connexions", "defis", "C", "Seize personnages, quatre familles cachées."),
  game("recrute-ton-equipage", "Recrute ton équipage", "defis", "C", "Un tirage au hasard, dix postes à pourvoir : compose le meilleur équipage."),
];

export function getGame(slug: string): Game | undefined {
  return GAMES.find((g) => g.slug === slug);
}
