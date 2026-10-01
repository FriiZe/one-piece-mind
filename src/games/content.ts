/**
 * Textes des pages de jeu : ce qui est lu par les moteurs de recherche et par
 * un joueur qui découvre le jeu. Un jeu n'est en ligne que s'il figure ici.
 */
import type { LiveSlug } from "@/lib/games/catalog";

export type GameContent = {
  /** Titre de l'onglet et des résultats de recherche. */
  metaTitle: string;
  metaDescription: string;
  intro: string;
  howTo: string[];
  faq: { question: string; answer: string }[];
};

const SPOILER_FAQ = {
  question: "Est-ce que le jeu peut me spoiler ?",
  answer:
    "Non. Avant de jouer, tu indiques si tu suis l'anime ou le manga. En mode anime, le jeu ne tire que des personnages déjà apparus dans l'anime et ne montre que des informations déjà adaptées.",
};

export const GAME_CONTENT: Record<LiveSlug, GameContent> = {
  onepiecedle: {
    metaTitle: "OnePiecedle : devine le personnage One Piece du jour",
    metaDescription:
      "Un personnage de One Piece à deviner chaque jour, le même pour tout le monde. Chaque essai t'indique ce qui est juste : affiliation, fruit, haki, prime, taille, origine, premier arc.",
    intro:
      "Chaque jour, un personnage mystère, le même pour tous les joueurs. Propose un nom : le jeu te dit ce que ton personnage a en commun avec celui à trouver. Recoupe les indices jusqu'à tomber juste.",
    howTo: [
      "Tape le nom d'un personnage et choisis-le dans la liste.",
      "Regarde les couleurs : vert, la case est juste ; orange, elle l'est en partie ; rouge, elle est fausse.",
      "Pour la prime, la taille et le premier arc, une flèche t'indique si la bonne valeur est plus haute ou plus basse.",
      "Recommence jusqu'à trouver, puis partage ta grille sans dévoiler la réponse.",
    ],
    faq: [
      {
        question: "À quelle heure change le personnage du jour ?",
        answer: "À minuit, heure de Paris. Tant que tu ne l'as pas trouvé, tes essais du jour sont conservés.",
      },
      {
        question: "Que veut dire une case orange ?",
        answer:
          "Que la réponse est partiellement juste : par exemple un haki en commun mais pas tous, ou un fruit de type Zoan alors que le personnage à trouver a un Zoan mythique.",
      },
      {
        question: "Puis-je jouer plus d'une fois par jour ?",
        answer: "Oui : l'onglet « Partie libre » tire un personnage au hasard, autant de fois que tu veux, avec trois niveaux de difficulté.",
      },
      SPOILER_FAQ,
    ],
  },
  revelation: {
    metaTitle: "Révélation : reconnais le personnage One Piece pixelisé",
    metaDescription:
      "Un portrait de personnage One Piece pixelisé qui se précise peu à peu. Reconnais-le le plus tôt possible : huit images par partie, trois niveaux de difficulté.",
    intro:
      "Le portrait commence en gros pavés de couleur et se précise toutes les cinq secondes. Une chevelure, un chapeau, une couleur de peau : à toi de reconnaître le personnage avant que l'image ne soit nette.",
    howTo: [
      "Observe l'image : elle gagne en netteté toutes les cinq secondes, en six paliers.",
      "Tape le nom du personnage dès que tu le reconnais.",
      "Une bonne réponse au premier palier vaut 6 points, puis un point de moins à chaque palier.",
      "Une erreur fait avancer l'image d'un palier. Huit images par partie, 48 points au maximum.",
    ],
    faq: [
      {
        question: "Tous les personnages ont-ils un portrait ?",
        answer: "Non : près de cinq cents personnages en ont un. Les autres n'apparaissent pas dans ce jeu, mais restent proposés dans la liste des réponses.",
      },
      {
        question: "Que se passe-t-il si je ne trouve pas ?",
        answer: "Au dernier palier, l'image reste affichée sans limite de temps. Une erreur à ce stade, ou le bouton « Passer », révèle la réponse sans rapporter de point.",
      },
      SPOILER_FAQ,
    ],
  },
  "zoom-extreme": {
    metaTitle: "Zoom extrême : reconnais le personnage One Piece à un détail",
    metaDescription:
      "Un détail très agrandi d'un portrait One Piece, qui dézoome peu à peu. Un œil, une cicatrice, un bout de chapeau : reconnais le personnage le plus tôt possible.",
    intro:
      "Tu ne vois d'abord qu'un détail du portrait, grossi cinq fois : un œil, une mèche, un morceau de vêtement. L'image s'élargit toutes les cinq secondes.",
    howTo: [
      "Observe le détail affiché : le cadre s'élargit toutes les cinq secondes, en six paliers.",
      "Tape le nom du personnage dès que tu le reconnais.",
      "Une bonne réponse au premier palier vaut 6 points, puis un point de moins à chaque palier.",
      "Une erreur élargit le cadre d'un palier. Huit images par partie, 48 points au maximum.",
    ],
    faq: [
      {
        question: "Quelle partie de l'image est agrandie ?",
        answer: "Un point choisi au hasard dans la moitié haute du portrait, là où se trouve le plus souvent le visage. Il change à chaque partie.",
      },
      {
        question: "Quelle différence avec Révélation ?",
        answer: "Dans Révélation, tu vois tout le portrait mais flou. Ici, tu vois net mais seulement un détail : les indices ne sont pas les mêmes.",
      },
      SPOILER_FAQ,
    ],
  },
  "avis-de-recherche": {
    metaTitle: "Avis de recherche : reconnais un pirate à sa prime",
    metaDescription:
      "Un avis de recherche One Piece sans nom ni photo : retrouve le personnage à partir de sa prime. Chaque erreur dévoile un indice, chaque indice coûte un point.",
    intro:
      "L'affiche est là, mais le nom et la photo ont disparu. Il te reste la prime. À toi de retrouver qui est recherché, avec le moins d'indices possible.",
    howTo: [
      "Lis la prime inscrite sur l'affiche et propose un personnage.",
      "Si tu te trompes, un indice se dévoile : affiliation, mer d'origine, arc de première apparition, puis initiale.",
      "Une affiche vaut 5 points sans indice, puis un point de moins par indice dévoilé.",
      "Cinq affiches par partie, pour un maximum de 25 points.",
    ],
    faq: [
      {
        question: "Plusieurs personnages ont la même prime : comment le jeu tranche-t-il ?",
        answer:
          "Toute réponse que les informations affichées ne permettent pas de distinguer de la bonne est acceptée. Tant qu'aucun indice n'est dévoilé, deux personnages à la prime identique sont donc tous les deux valables.",
      },
      {
        question: "D'où viennent les primes ?",
        answer: "De la dernière prime connue de chaque personnage dans le manga, ou dans l'anime si tu joues en mode anime.",
      },
      SPOILER_FAQ,
    ],
  },
  "plus-ou-moins": {
    metaTitle: "Plus ou moins : compare les primes de One Piece",
    metaDescription:
      "Deux personnages de One Piece, deux primes : laquelle est la plus haute ? Enchaîne les bonnes réponses et bats ton record de série.",
    intro:
      "Deux avis de recherche côte à côte. Tu connais la prime du premier : celle du second est-elle plus haute ou plus basse ? La série continue tant que tu ne te trompes pas.",
    howTo: [
      "Compare la prime affichée à celle, cachée, du second personnage.",
      "Choisis « Plus haute » ou « Plus basse ».",
      "Si tu as raison, le second personnage devient la référence et un nouveau arrive.",
      "À la première erreur, la série s'arrête : ton record est conservé pour chaque niveau de difficulté.",
    ],
    faq: [
      {
        question: "Peut-on tomber sur deux primes égales ?",
        answer: "Non, le jeu ne met jamais face à face deux personnages à la prime identique.",
      },
      {
        question: "Que change la difficulté ?",
        answer:
          "Le niveau facile ne tire que des personnages majeurs. Le niveau expert ajoute les seconds rôles et les figurants, dont les primes sont bien moins connues.",
      },
      SPOILER_FAQ,
    ],
  },
  "le-classement": {
    metaTitle: "Le classement : range les personnages de One Piece",
    metaDescription:
      "Cinq personnages de One Piece à ranger par prime, par taille ou par âge. Cinq manches, un point par personnage au bon rang.",
    intro:
      "Cinq personnages, un critère : la prime, la taille ou l'âge. À toi de les remettre dans l'ordre, du plus grand au plus petit.",
    howTo: [
      "Lis le critère de la manche : prime, taille ou âge.",
      "Déplace les personnages avec les flèches jusqu'à obtenir le bon ordre, le plus grand en haut.",
      "Valide : chaque personnage placé au bon rang rapporte un point, et les vraies valeurs s'affichent.",
      "Cinq manches par partie, pour un maximum de 25 points.",
    ],
    faq: [
      {
        question: "Quelles tailles et quels âges sont utilisés ?",
        answer: "Les valeurs les plus récentes données par l'auteur, c'est-à-dire celles d'après l'ellipse pour les personnages concernés.",
      },
      {
        question: "Deux personnages peuvent-ils avoir la même valeur ?",
        answer: "Non, les cinq personnages d'une manche ont toujours des valeurs différentes : il n'y a qu'un seul bon ordre.",
      },
      SPOILER_FAQ,
    ],
  },
  "type-de-fruit": {
    metaTitle: "Type de fruit : Paramecia, Zoan ou Logia ?",
    metaDescription:
      "Dix fruits du démon de One Piece : retrouve pour chacun son type, Paramecia, Zoan ou Logia. Un quiz rapide pour tester ta connaissance des fruits.",
    intro:
      "Un fruit du démon s'affiche avec son nom français et son nom japonais. Une seule question : est-ce un Paramecia, un Logia ou un Zoan ?",
    howTo: [
      "Lis le nom du fruit.",
      "Choisis son type parmi Paramecia, Logia et Zoan.",
      "La correction précise le type exact, par exemple Zoan antique ou Zoan mythique.",
      "Dix fruits par partie : ton meilleur score est conservé.",
    ],
    faq: [
      {
        question: "Quelle différence entre Paramecia, Zoan et Logia ?",
        answer:
          "Un Paramecia donne un pouvoir surhumain ou modifie le corps. Un Zoan permet de se transformer en animal, parfois antique ou mythique. Un Logia permet de créer un élément, de le contrôler et de se changer en lui.",
      },
      {
        question: "Les SMILE font-ils partie du jeu ?",
        answer: "Non. Les fruits artificiels, comme les SMILE, sont laissés de côté : seuls les vrais fruits du démon sont tirés.",
      },
      SPOILER_FAQ,
    ],
  },
  "qui-a-mange-ce-fruit": {
    metaTitle: "Qui a mangé ce fruit ? Le quiz des fruits du démon",
    metaDescription:
      "Retrouve l'utilisateur de chaque fruit du démon de One Piece, ou le fruit de chaque personnage. Dix questions à quatre réponses, trois niveaux de difficulté.",
    intro:
      "Le quiz se joue dans les deux sens : un fruit s'affiche et tu dois retrouver qui l'a mangé, ou un personnage s'affiche et tu dois retrouver son fruit.",
    howTo: [
      "Choisis un niveau de difficulté.",
      "À chaque question, sélectionne la bonne réponse parmi quatre.",
      "La correction s'affiche tout de suite.",
      "Dix questions par partie : ton record est conservé pour chaque niveau.",
    ],
    faq: [
      {
        question: "Que se passe-t-il quand un fruit a eu plusieurs utilisateurs ?",
        answer: "Une seule des réponses proposées est juste : les autres utilisateurs du même fruit ne sont jamais proposés comme mauvaises réponses.",
      },
      {
        question: "Pourquoi les fruits ont-ils deux noms ?",
        answer: "Le premier est le nom de l'édition française, le second le nom japonais, celui qu'utilisent la plupart des fans de l'anime.",
      },
      SPOILER_FAQ,
    ],
  },
  "trouve-les-tous": {
    metaTitle: "Trouve-les tous : cite tous les membres d'un groupe de One Piece",
    metaDescription:
      "Les Chapeaux de paille, les Grands Corsaires, les Supernovas, les commandants de Barbe Blanche : cite tous les membres d'un groupe de One Piece avant la fin du chrono.",
    intro:
      "Choisis un groupe, lance le chrono et tape les noms qui te viennent. Chaque nom reconnu s'inscrit tout seul : inutile de valider.",
    howTo: [
      "Choisis un groupe : équipage, organisation ou génération de pirates.",
      "Tape les noms les uns après les autres. Un prénom suffit quand il ne désigne qu'un seul membre.",
      "Le chrono laisse douze secondes par personnage, avec une minute au minimum.",
      "À la fin, les membres oubliés s'affichent en rouge.",
    ],
    faq: [
      {
        question: "Faut-il écrire les noms sans faute ?",
        answer: "Les accents, les majuscules et la ponctuation sont ignorés, et les noms français comme les noms d'origine sont acceptés. Le reste doit être juste.",
      },
      {
        question: "Pourquoi certains groupes n'apparaissent-ils pas ?",
        answer: "En mode anime, un groupe n'est proposé que si tous ses membres sont déjà apparus dans l'anime et que sa composition y a été révélée.",
      },
      SPOILER_FAQ,
    ],
  },
};
