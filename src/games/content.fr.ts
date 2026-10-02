/** Textes français des pages de jeu (voir content.ts). */
import type { LiveSlug } from "@/lib/games/catalog";
import type { GameContent } from "./content";

const SPOILER_FAQ = {
  question: "Est-ce que le jeu peut me spoiler ?",
  answer:
    "Non. Avant de jouer, tu indiques si tu suis l'anime ou le manga. En mode anime, le jeu ne tire que des personnages déjà apparus dans l'anime et ne montre que des informations déjà adaptées.",
};

export const GAME_CONTENT_FR: Record<LiveSlug, GameContent> = {
  onepiecedle: {
    metaTitle: "OnePiecedle : devine le personnage One Piece du jour",
    metaDescription:
      "Un personnage de One Piece à deviner chaque jour, le même pour tout le monde. Chaque essai t'indique ce qui est juste : genre, affiliation, fruit, haki, prime, taille, origine, premier arc.",
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
      "Un portrait de personnage One Piece pixelisé, qui se précise à chacune de tes propositions. Reconnais-le en un minimum d'essais : huit images par partie, trois niveaux de difficulté.",
    intro:
      "Le portrait commence en gros pavés de couleur et ne se précise qu'après chacune de tes propositions. Une chevelure, un chapeau, une couleur de peau : à toi de reconnaître le personnage avant que l'image ne soit nette.",
    howTo: [
      "Observe l'image : elle passe par six paliers de netteté, et n'avance que lorsque tu te trompes. Prends ton temps, il n'y a pas de chrono.",
      "Tape le nom du personnage dès que tu le reconnais.",
      "Une bonne réponse au premier palier vaut 6 points, puis un point de moins à chaque palier.",
      "Aucune idée ? Un bouton précise l'image sans proposer de nom : il coûte un palier, comme une erreur. Huit images par partie, 48 points au maximum.",
    ],
    faq: [
      {
        question: "Tous les personnages ont-ils un portrait ?",
        answer: "Non : près de cinq cents personnages en ont un. Les autres n'apparaissent pas dans ce jeu, mais restent proposés dans la liste des réponses.",
      },
      {
        question: "Que se passe-t-il si je ne trouve pas ?",
        answer: "L'image n'avance jamais toute seule. Au dernier palier, une erreur révèle la réponse sans rapporter de point, tout comme le bouton « Passer ».",
      },
      SPOILER_FAQ,
    ],
  },
  "zoom-extreme": {
    metaTitle: "Zoom extrême : reconnais le personnage One Piece à un détail",
    metaDescription:
      "Un détail très agrandi d'un portrait One Piece, qui dézoome à chacune de tes propositions. Un œil, une cicatrice, un bout de chapeau : reconnais le personnage en un minimum d'essais.",
    intro:
      "Tu ne vois d'abord qu'un détail du portrait, grossi cinq fois : un œil, une mèche, un morceau de vêtement. L'image ne s'élargit qu'après chacune de tes propositions.",
    howTo: [
      "Observe le détail affiché : le cadre s'élargit en six paliers, et n'avance que lorsque tu te trompes. Prends ton temps, il n'y a pas de chrono.",
      "Tape le nom du personnage dès que tu le reconnais.",
      "Une bonne réponse au premier palier vaut 6 points, puis un point de moins à chaque palier.",
      "Aucune idée ? Un bouton dézoome sans proposer de nom : il coûte un palier, comme une erreur. Huit images par partie, 48 points au maximum.",
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
      "Si tu te trompes, un indice se dévoile : affiliation, mer d'origine, arc de première apparition, surnom quand le personnage en a un, puis initiale.",
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
  memo: {
    metaTitle: "Mémo One Piece : associe chaque personnage à son fruit du démon",
    metaDescription:
      "Un jeu de mémoire One Piece : seize cartes, huit paires. Retrouve le fruit du démon, le surnom ou l'arme de chaque personnage en retournant le moins de cartes possible.",
    intro:
      "Seize cartes face cachée. Huit portent un personnage ; les huit autres, selon la partie, un fruit du démon, un surnom ou une arme. À toi de reformer les paires, de mémoire.",
    howTo: [
      "Retourne deux cartes : si le fruit, le surnom ou l'arme est bien celui du personnage, la paire reste visible.",
      "Sinon, les deux cartes se retournent au bout d'une seconde : retiens où elles sont.",
      "La partie se termine quand les huit paires sont trouvées. Moins tu joues de coups, plus tu marques.",
    ],
    faq: [
      {
        question: "Comment est calculé le score ?",
        answer: "Une partie sans aucune erreur se joue en 8 coups et vaut 16 points. Chaque coup supplémentaire retire un point, avec un minimum d'un point.",
      },
      {
        question: "Deux personnages peuvent-ils avoir le même fruit dans une partie ?",
        answer: "Non. Quand un fruit a eu plusieurs utilisateurs, un seul d'entre eux est tiré : chaque carte n'a qu'une seule carte jumelle.",
      },
      SPOILER_FAQ,
    ],
  },
  wordle: {
    metaTitle: "Wordle One Piece : trouve le nom du personnage en six essais",
    metaDescription:
      "Le Wordle de One Piece : un nom de personnage à deviner en six essais. Les lettres bien placées passent au vert, les lettres mal placées à l'orange.",
    intro:
      "Un nom de personnage se cache derrière les cases. Propose un mot de la bonne longueur : les couleurs te disent quelles lettres sont bien placées.",
    howTo: [
      "Tape un mot du nombre de lettres indiqué et valide.",
      "Vert : la lettre est à sa place. Orange : elle est dans le nom, mais ailleurs. Gris : elle n'y est pas.",
      "Tu as six essais. À partir du quatrième, l'affiliation du personnage est donnée en indice.",
    ],
    faq: [
      {
        question: "Faut-il proposer un vrai nom de personnage ?",
        answer: "Non. N'importe quelle suite de lettres de la bonne longueur est acceptée, ce qui permet de tester des lettres.",
      },
      {
        question: "Quels noms peuvent tomber ?",
        answer: "Les noms d'un seul mot, de 4 à 8 lettres, écrits sans accent. La difficulté choisie détermine la notoriété des personnages.",
      },
      SPOILER_FAQ,
    ],
  },
  anagramme: {
    metaTitle: "Anagramme One Piece : remets les lettres du nom dans l'ordre",
    metaDescription:
      "Huit noms de personnages One Piece dont les lettres ont été mélangées. Retrouve chaque nom, avec l'affiliation du personnage pour seul indice.",
    intro: "Les lettres d'un nom de personnage ont été mélangées. À toi de le reconstituer.",
    howTo: [
      "Observe les lettres mélangées et l'affiliation donnée en indice.",
      "Tape le nom et valide. En cas d'erreur, tu peux réessayer autant de fois que tu veux.",
      "Si tu sèches, passe : la réponse s'affiche et tu ne marques pas le point. Huit noms par partie.",
    ],
    faq: [
      {
        question: "Les accents comptent-ils ?",
        answer: "Non. Les accents et les majuscules sont ignorés : seul l'ordre des lettres compte.",
      },
      {
        question: "Quels noms sont mélangés ?",
        answer: "Des noms d'un seul mot, de 5 à 10 lettres. Plus la difficulté est élevée, moins les personnages sont connus.",
      },
      SPOILER_FAQ,
    ],
  },
  "les-indices": {
    metaTitle: "Les indices : devine le personnage One Piece avec le moins d'indices",
    metaDescription:
      "Un personnage One Piece à deviner à partir d'indices de plus en plus précis : arc, origine, fruit, haki, affiliation, prime, surnom. Moins tu en utilises, plus tu marques.",
    intro:
      "Le premier indice est vague, le dernier donne presque la réponse. À toi de trouver le personnage le plus tôt possible.",
    howTo: [
      "Lis le premier indice et propose un personnage.",
      "Chaque erreur dévoile l'indice suivant ; tu peux aussi en demander un sans proposer de nom.",
      "Une manche vaut 10 points avec un seul indice, puis un point de moins par indice dévoilé, sans descendre sous 5. Une fois l'initiale affichée, elle n'en vaut plus que 2. Cinq manches par partie.",
    ],
    faq: [
      {
        question: "Dans quel ordre viennent les indices ?",
        answer: "L'arc de première apparition, l'origine, le type de fruit du démon, les hakis, l'affiliation, la prime, le surnom quand le personnage en a un, puis l'initiale du nom.",
      },
      {
        question: "Que se passe-t-il si je me trompe au dernier indice ?",
        answer: "La manche est perdue et la réponse s'affiche. Tu peux aussi passer une manche à tout moment, sans marquer de point.",
      },
      SPOILER_FAQ,
    ],
  },
  surnoms: {
    metaTitle: "Surnoms One Piece : qui est « le chirurgien de la mort » ?",
    metaDescription:
      "Dix surnoms de One Piece, quatre personnages proposés à chaque fois : retrouve qui se cache derrière « la chatte voleuse » ou « le paladin des mers ».",
    intro: "Chaque pirate célèbre a son surnom, inscrit sur son avis de recherche. Sauras-tu les rendre à leur propriétaire ?",
    howTo: [
      "Lis le surnom affiché. Une fois sur trois, c'est l'inverse : un personnage s'affiche, à toi de retrouver son surnom.",
      "Choisis la bonne réponse parmi les quatre proposées.",
      "La correction s'affiche tout de suite. Dix surnoms par partie.",
    ],
    faq: [
      {
        question: "Les surnoms sont-ils ceux de l'édition française ?",
        answer: "Oui, autant que possible : les surnoms sont donnés en français. Les noms de code, comme ceux des agents de Baroque Works ou des amiraux, en font partie.",
      },
      {
        question: "Tous les personnages ont-ils un surnom ?",
        answer: "Non. Le jeu porte sur environ soixante-dix personnages dont le surnom est bien établi.",
      },
      SPOILER_FAQ,
    ],
  },
  orthographe: {
    metaTitle: "Orthographe One Piece : sais-tu écrire les noms des personnages ?",
    metaDescription:
      "Donquixote ou Don Quichotte ? Dix personnages One Piece, quatre graphies de leur nom à chaque fois : une seule est la bonne.",
    intro:
      "Les noms de One Piece sont pleins de pièges. Le portrait te dit de qui il s'agit : à toi de retrouver la bonne graphie parmi quatre.",
    howTo: [
      "Regarde le portrait et l'affiliation : ils désignent le personnage.",
      "Choisis la bonne orthographe de son nom parmi les quatre proposées. Une fois sur trois, c'est le nom d'une de ses techniques ou de son arme qu'il faut écrire.",
      "Les trois autres ne diffèrent que d'une lettre : lis bien. Dix noms par partie.",
    ],
    faq: [
      {
        question: "Quelle orthographe fait foi ?",
        answer: "Celle de l'édition française du manga, qui peut différer des sous-titres de l'anime pour quelques personnages.",
      },
      {
        question: "Quelles fautes sont glissées dans les mauvaises réponses ?",
        answer: "Deux lettres inversées, une consonne doublée ou dédoublée, une voyelle remplacée par sa voisine : des fautes discrètes, jamais sur la première lettre.",
      },
      SPOILER_FAQ,
    ],
  },
  emojis: {
    metaTitle: "Emojis One Piece : devine le personnage en quelques emojis",
    metaDescription:
      "Un chapeau de paille, de la viande, un drapeau pirate : qui est-ce ? Cinq personnages One Piece à deviner à partir de quelques emojis.",
    intro: "Quelques emojis résument un personnage : son apparence, son pouvoir, ses manies. À toi de le reconnaître.",
    howTo: [
      "Observe les emojis et propose un personnage.",
      "Chaque erreur dévoile un indice : la mer d'origine, l'affiliation, l'arc de première apparition, puis l'initiale.",
      "Une manche vaut 5 points sans indice, puis un point de moins par indice. Cinq manches par partie.",
    ],
    faq: [
      {
        question: "Combien de personnages ont leur devinette ?",
        answer: "Plus de cent soixante-dix, des héros aux seconds rôles.",
      },
      {
        question: "Les emojis s'affichent mal sur mon appareil, que faire ?",
        answer: "Certains emojis récents ne sont pas dessinés par tous les systèmes. Les indices suivants permettent quand même de trouver le personnage.",
      },
      SPOILER_FAQ,
    ],
  },
  "devine-la-prime": {
    metaTitle: "Devine la prime : estime les primes des pirates de One Piece",
    metaDescription:
      "Huit personnages One Piece primés : estime la prime de chacun avec le curseur. Plus tu es proche de la vraie valeur, plus tu marques de points.",
    intro: "Un personnage, un curseur : à toi d'estimer sa prime. Pas besoin de tomber juste, il suffit d'être proche.",
    howTo: [
      "Déplace le curseur jusqu'à la prime que tu estimes, puis valide.",
      "Tu marques 5 points à moins de 10 % d'écart, puis de moins en moins : 1 point tant que tu ne te trompes pas de plus d'un facteur trois.",
      "Huit personnages par partie, pour un maximum de 40 points.",
    ],
    faq: [
      {
        question: "Pourquoi le curseur avance-t-il si vite vers les grosses primes ?",
        answer: "Les primes vont d'un million à plusieurs milliards : le curseur suit une échelle qui donne autant de place à chaque ordre de grandeur.",
      },
      {
        question: "Quelle prime est retenue ?",
        answer: "La dernière prime connue du personnage, dans le manga ou dans l'anime selon ton mode.",
      },
      SPOILER_FAQ,
    ],
  },
  "grand-ou-vieux": {
    metaTitle: "Grand ou vieux : qui est le plus grand, le plus âgé dans One Piece ?",
    metaDescription:
      "Dix duels entre personnages One Piece : lequel est le plus grand ? Lequel est le plus âgé ? Les tailles officielles réservent des surprises.",
    intro: "Deux personnages face à face. Une question simple, en apparence : qui est le plus grand, ou le plus âgé ?",
    howTo: [
      "Lis bien la question : elle porte sur la taille ou sur l'âge, et demande tantôt le plus grand ou le plus âgé, tantôt le plus petit ou le plus jeune.",
      "Choisis l'un des deux personnages.",
      "La correction donne les deux valeurs. Dix duels par partie.",
    ],
    faq: [
      {
        question: "D'où viennent les tailles et les âges ?",
        answer: "Des fiches officielles publiées par l'auteur. Pour les personnages concernés, ce sont les valeurs d'après l'ellipse.",
      },
      {
        question: "Peut-on tomber sur deux personnages de même taille ?",
        answer: "Non, les deux personnages d'un duel ont toujours des valeurs différentes.",
      },
      SPOILER_FAQ,
    ],
  },
  "premiere-apparition": {
    metaTitle: "Première apparition : dans quel chapitre ce personnage arrive-t-il ?",
    metaDescription:
      "Huit personnages One Piece : retrouve le chapitre, ou l'épisode, de leur première apparition. Dix points pour le numéro exact, puis un de moins tous les douze numéros d'écart.",
    intro:
      "Tu te souviens de l'arc, mais du numéro ? Place le curseur sur le chapitre ou l'épisode où le personnage apparaît pour la première fois.",
    howTo: [
      "Déplace le curseur jusqu'au numéro que tu estimes, puis valide.",
      "Le numéro exact vaut 10 points. Ensuite, tu perds un point tous les douze numéros d'écart environ : 9 jusqu'à 12, 8 jusqu'à 24, 7 jusqu'à 37, 6 jusqu'à 49, 5 jusqu'à 61, 4 jusqu'à 74, 3 jusqu'à 86, 2 jusqu'à 99 et 1 jusqu'à 150. Au-delà, rien.",
      "Huit personnages par partie, pour un maximum de 80 points.",
    ],
    faq: [
      {
        question: "Chapitres ou épisodes ?",
        answer: "Les épisodes si tu joues en mode anime, les chapitres si tu joues en mode manga.",
      },
      {
        question: "Une apparition dans un flashback compte-t-elle ?",
        answer: "Oui : c'est la toute première apparition du personnage qui est retenue, même en flashback ou en silhouette.",
      },
      SPOILER_FAQ,
    ],
  },
  "prime-d-equipage": {
    metaTitle: "Prime d'équipage : estime le total des primes d'un équipage",
    metaDescription:
      "Combien pèse l'équipage du Chapeau de paille, celui de Barbe Noire ou des Cent Bêtes ? Estime le total des primes connues de chaque équipage One Piece.",
    intro: "Additionne de tête les primes de tout un équipage, puis place le curseur. Plus tu es proche du total, plus tu marques.",
    howTo: [
      "Lis le nom de l'équipage et le nombre de ses membres primés.",
      "Déplace le curseur jusqu'au total que tu estimes, puis valide.",
      "Huit équipages par partie, pour un maximum de 40 points.",
    ],
    faq: [
      {
        question: "Quelles primes sont additionnées ?",
        answer: "Les dernières primes connues des membres de l'équipage présents dans le jeu. Le total peut donc être inférieur au chiffre officiel quand un membre manque.",
      },
      {
        question: "Quels équipages peuvent tomber ?",
        answer: "Ceux qui comptent au moins trois membres primés.",
      },
      SPOILER_FAQ,
    ],
  },
  equipage: {
    metaTitle: "Équipage : à quelle organisation appartient ce personnage ?",
    metaDescription:
      "Dix personnages One Piece à ranger dans leur équipage ou leur organisation : pirates, Marine, révolutionnaires, royaumes. Quatre propositions à chaque fois.",
    intro: "Pirate, marine, révolutionnaire ? Retrouve l'équipage ou l'organisation de chaque personnage.",
    howTo: [
      "Lis le nom du personnage, et regarde son portrait quand il y en a un.",
      "Choisis son organisation parmi les quatre proposées. Une fois sur trois, c'est l'inverse : une organisation s'affiche, à toi de retrouver lequel des quatre personnages en fait partie.",
      "La correction s'affiche tout de suite. Dix personnages par partie.",
    ],
    faq: [
      {
        question: "Quelle affiliation est retenue quand un personnage en a eu plusieurs ?",
        answer: "Son affiliation actuelle, ou la dernière connue pour un personnage décédé.",
      },
      {
        question: "Que change la difficulté ?",
        answer: "Le niveau facile se limite aux personnages majeurs. Le niveau expert ajoute les seconds rôles et les figurants.",
      },
      SPOILER_FAQ,
    ],
  },
  haki: {
    metaTitle: "Haki : quels hakis maîtrise ce personnage de One Piece ?",
    metaDescription:
      "Observation, armement, haki des rois : dix personnages One Piece, et pour chacun la bonne combinaison de hakis à retrouver parmi quatre.",
    intro: "Certains n'en maîtrisent aucun, d'autres les trois. Retrouve les hakis de chaque personnage.",
    howTo: [
      "Lis le nom du personnage.",
      "Choisis la bonne combinaison : aucun haki, un seul, deux, ou les trois. Parfois, c'est le détenteur du haki des rois qu'il faut retrouver parmi quatre personnages.",
      "La correction s'affiche tout de suite. Dix personnages par partie.",
    ],
    faq: [
      {
        question: "Quels sont les trois hakis ?",
        answer: "Le haki de l'observation, qui perçoit les présences et anticipe les coups ; le haki de l'armement, qui durcit le corps ; le haki des rois, que seuls quelques élus possèdent.",
      },
      {
        question: "Un haki utilisé seulement dans un film compte-t-il ?",
        answer: "Non. Seuls les hakis montrés dans le manga sont retenus.",
      },
      SPOILER_FAQ,
    ],
  },
  techniques: {
    metaTitle: "Techniques One Piece : à qui appartient cette attaque ?",
    metaDescription:
      "Gomu Gomu no Pistol, Room, Diable Jambe : dix techniques de One Piece, et quatre personnages proposés à chaque fois. Qui utilise quoi ?",
    intro: "Le nom d'une attaque s'affiche. À toi de retrouver le personnage qui la crie en combat.",
    howTo: [
      "Lis le nom de la technique. Une fois sur trois, c'est l'inverse : un personnage s'affiche, à toi de retrouver sa technique.",
      "Choisis la bonne réponse parmi les quatre proposées.",
      "La correction s'affiche tout de suite. Dix techniques par partie.",
    ],
    faq: [
      {
        question: "Dans quelle langue sont les noms des techniques ?",
        answer: "Dans leur forme d'origine, telle qu'on l'entend dans l'anime en version originale.",
      },
      {
        question: "Une technique partagée par plusieurs personnages peut-elle tomber ?",
        answer: "Non. Seules les techniques propres à un seul personnage sont utilisées.",
      },
      SPOILER_FAQ,
    ],
  },
  "armes-et-sabres": {
    metaTitle: "Armes et sabres de One Piece : qui manie Yoru, Shigure, Kikoku ?",
    metaDescription:
      "Dix armes célèbres de One Piece, sabres de légende en tête. Retrouve le personnage qui manie chacune parmi quatre propositions.",
    intro: "Sabres de légende, bâton climatique, trident : chaque arme a son porteur. Sauras-tu les associer ?",
    howTo: [
      "Lis le nom de l'arme et sa nature. Une fois sur trois, c'est l'inverse : un personnage s'affiche, à toi de retrouver son arme.",
      "Choisis la bonne réponse parmi les quatre proposées.",
      "La correction s'affiche tout de suite. Dix armes par partie.",
    ],
    faq: [
      {
        question: "Quel porteur est retenu quand une arme a changé de mains ?",
        answer: "Le porteur le plus connu. Les armes dont le propriétaire prête à discussion ne sont pas utilisées.",
      },
      {
        question: "Y a-t-il seulement des sabres ?",
        answer: "Non : on trouve aussi une massue, un trident, un lance-pierre géant ou un bâton climatique.",
      },
      SPOILER_FAQ,
    ],
  },
  navires: {
    metaTitle: "Navires de One Piece : à quel équipage appartient ce bateau ?",
    metaDescription:
      "Vogue Merry, Moby Dick, Oro Jackson, Polar Tang : dix navires de One Piece à rendre à leur équipage, avec quatre propositions à chaque fois.",
    intro: "Un nom de navire s'affiche. À quel équipage appartient-il ?",
    howTo: [
      "Lis le nom du navire. Parfois, c'est l'inverse : un équipage s'affiche, à toi de retrouver son navire.",
      "Choisis la bonne réponse parmi les quatre proposées.",
      "La correction s'affiche tout de suite. Dix navires par partie.",
    ],
    faq: [
      {
        question: "Combien de navires compte le jeu ?",
        answer: "Vingt-six pour l'instant, parmi les plus connus de la série.",
      },
      {
        question: "Pourquoi n'y a-t-il pas de niveau de difficulté ?",
        answer: "Parce que les navires nommés sont peu nombreux : tous peuvent tomber dans une même partie.",
      },
      SPOILER_FAQ,
    ],
  },
  "origine-et-race": {
    metaTitle: "Origine et race : d'où viennent les personnages de One Piece ?",
    metaDescription:
      "East Blue, Grand Line, îles célestes ? Humain, homme-poisson, mink, géant ? Dix questions sur la mer d'origine et la race des personnages One Piece.",
    intro: "Une question sur deux porte sur la mer d'origine, l'autre sur la race. Dix personnages à situer.",
    howTo: [
      "Lis la question : la mer d'origine ou la race d'un personnage, ou le personnage qui vient d'une mer ou appartient à une race.",
      "Choisis la bonne réponse parmi les quatre proposées.",
      "La correction s'affiche tout de suite. Dix questions par partie.",
    ],
    faq: [
      {
        question: "Que répondre pour un personnage métis ?",
        answer: "La race non humaine du personnage est la bonne réponse, et son autre race n'est jamais proposée comme mauvaise réponse.",
      },
      {
        question: "Grand Line et Nouveau Monde sont-ils distingués ?",
        answer: "Non. Le Nouveau Monde est la seconde moitié de Grand Line : les deux sont regroupés sous Grand Line.",
      },
      SPOILER_FAQ,
    ],
  },
  chronologie: {
    metaTitle: "Chronologie One Piece : remets les arcs dans l'ordre",
    metaDescription:
      "Cinq arcs, ou cinq personnages, à remettre dans l'ordre de l'histoire de One Piece. Cinq manches, un point par élément placé au bon rang.",
    intro: "Avant ou après Alabasta ? Remets les arcs, puis les personnages, dans l'ordre où ils arrivent dans l'histoire.",
    howTo: [
      "Lis la consigne : il s'agit d'ordonner des arcs, ou des personnages par ordre d'apparition.",
      "Déplace les éléments avec les flèches, le plus ancien en haut.",
      "Valide : chaque élément au bon rang rapporte un point. Cinq manches par partie.",
    ],
    faq: [
      {
        question: "Quel ordre est retenu pour les personnages ?",
        answer: "Celui de leur première apparition dans le manga. Les cinq personnages d'une manche viennent toujours de cinq arcs différents.",
      },
      {
        question: "Les arcs propres à l'anime sont-ils inclus ?",
        answer: "Non, seuls les arcs du manga sont utilisés.",
      },
      SPOILER_FAQ,
    ],
  },
  "dans-quel-arc": {
    metaTitle: "Dans quel arc ? La première apparition des personnages One Piece",
    metaDescription:
      "Dix personnages One Piece : dans quel arc chacun apparaît-il pour la première fois ? Quatre arcs proposés à chaque question.",
    intro: "Tu connais le personnage, mais te souviens-tu de l'arc où il entre en scène ?",
    howTo: [
      "Lis le nom du personnage, et regarde son portrait quand il y en a un.",
      "Choisis l'arc de sa première apparition parmi les quatre proposés. Une fois sur trois, c'est l'inverse : un arc s'affiche, à toi de retrouver le personnage qui y fait son entrée.",
      "La correction s'affiche tout de suite. Dix personnages par partie.",
    ],
    faq: [
      {
        question: "Une apparition en flashback compte-t-elle ?",
        answer: "Oui. C'est l'arc où le personnage est vu pour la toute première fois qui est retenu, même s'il n'y joue aucun rôle.",
      },
      {
        question: "Quels arcs sont proposés ?",
        answer: "Les arcs du manga, jusqu'au dernier que tu connais selon ton mode.",
      },
      SPOILER_FAQ,
    ],
  },
  "vrai-ou-faux": {
    metaTitle: "Vrai ou faux One Piece : dix affirmations à trancher",
    metaDescription:
      "Dix affirmations sur les personnages de One Piece : fruit du démon, prime, haki, origine, surnom, technique, arme, taille, âge. Vrai ou faux ? Un quiz rapide à enchaîner.",
    intro: "Une affirmation, deux boutons. Dix fois de suite, sans réfléchir trop longtemps.",
    howTo: [
      "Lis l'affirmation.",
      "Réponds par vrai ou par faux.",
      "La correction rétablit la vérité. Dix affirmations par partie.",
    ],
    faq: [
      {
        question: "Sur quoi portent les affirmations ?",
        answer: "Le type de fruit du démon, l'affiliation, la comparaison de deux primes, le haki des rois, l'arc de première apparition et la mer d'origine.",
      },
      {
        question: "Y a-t-il autant de vrai que de faux ?",
        answer: "En moyenne, oui : chaque affirmation a une chance sur deux d'être vraie.",
      },
      SPOILER_FAQ,
    ],
  },
  "mode-aleatoire": {
    metaTitle: "Mode aléatoire : dix questions One Piece tirées dans tous les quiz",
    metaDescription:
      "Un quiz One Piece qui pioche dans tous les autres : équipages, hakis, techniques, surnoms, navires, arcs. Dix questions, jamais les mêmes.",
    intro: "Tu ne sais pas à quoi jouer ? Ce mode pioche ses questions dans tous les quiz du site.",
    howTo: [
      "Choisis un niveau de difficulté.",
      "Réponds aux dix questions : chacune vient d'un quiz tiré au hasard, avec sa propre consigne.",
      "La correction s'affiche après chaque réponse.",
    ],
    faq: [
      {
        question: "Dans quels jeux les questions sont-elles tirées ?",
        answer:
          "Équipage, Navires, Origine et race, Dans quel arc ?, Vrai ou faux, Techniques, Armes et sabres, Surnoms, Orthographe, Grand ou vieux et Haki.",
      },
      {
        question: "Peut-on tomber deux fois sur la même question ?",
        answer: "Pas dans une même partie.",
      },
      SPOILER_FAQ,
    ],
  },
  "duo-carre-cash": {
    metaTitle: "Duo, Carré ou Cash : le quiz One Piece où tu choisis ton risque",
    metaDescription:
      "Un quiz One Piece en Duo, Carré ou Cash : deux propositions pour 1 point, quatre pour 3 points, ou aucune pour 5 points. Dix questions sur les équipages, les techniques, les surnoms et les arcs.",
    intro:
      "Avant chaque réponse, tu choisis ton risque. Duo : deux propositions, 1 point. Carré : quatre propositions, 3 points. Cash : aucune proposition, tu écris la réponse, et elle vaut 5 points.",
    howTo: [
      "Choisis un niveau de difficulté.",
      "Lis la question, puis choisis Duo, Carré ou Cash. Une fois les propositions affichées, tu ne peux plus changer.",
      "En Cash, écris ta réponse : la casse, les accents et une petite faute de frappe ne comptent pas.",
      "La correction s'affiche après chaque réponse. Le score maximal est de 50 points.",
    ],
    faq: [
      {
        question: "Comment est jugée une réponse en Cash ?",
        answer:
          "Elle est comparée à la bonne réponse sans tenir compte des majuscules, des accents ni de la ponctuation, et une faute de frappe est tolérée. Pour un personnage, son nom d'usage suffit : « Luffy » vaut « Monkey D. Luffy ». Pour un équipage, « Chapeau de paille » vaut « Équipage du Chapeau de paille ».",
      },
      {
        question: "Sur quoi portent les questions ?",
        answer: "Sur les équipages, les navires, les mers d'origine et les races, les arcs, les techniques, les armes et les surnoms.",
      },
      {
        question: "Peut-on jouer à des quiz écrits par d'autres joueurs ?",
        answer:
          "Oui. La page « Quiz de la commu » rassemble les quiz créés par les joueurs, qui se jouent eux aussi en Duo, Carré ou Cash. Avec un compte, tu peux créer le tien.",
      },
      SPOILER_FAQ,
    ],
  },
  connexions: {
    metaTitle: "Connexions One Piece : seize personnages, quatre familles cachées",
    metaDescription:
      "Seize personnages de One Piece à regrouper en quatre familles de quatre : équipage, mer d'origine, type de fruit, arc. Quatre erreurs permises.",
    intro:
      "Seize personnages, quatre familles de quatre. Ce qui les relie n'est pas dit : un équipage, une mer d'origine, un type de fruit, un arc. À toi de retrouver les quatre familles.",
    howTo: [
      "Sélectionne quatre personnages que tu crois liés, puis valide.",
      "Si c'est une famille, elle s'affiche avec son nom. Sinon, tu perds une des quatre erreurs permises.",
      "Le jeu te prévient quand un seul des quatre n'est pas à sa place.",
      "Un point par famille trouvée.",
    ],
    faq: [
      {
        question: "Un personnage peut-il appartenir à deux familles ?",
        answer: "Non : dans chaque grille, chaque personnage n'entre que dans une seule des quatre familles.",
      },
      {
        question: "De quoi sont faites les familles ?",
        answer: "D'une affiliation, d'un groupe (Supernovas, Grands Corsaires…), d'une mer d'origine, d'une race, d'un type de fruit, d'un haki, d'un palier de prime, d'un arc de première apparition ou, plus retors, de l'initiale du nom.",
      },
      SPOILER_FAQ,
    ],
  },
  grille: {
    metaTitle: "Grille 3×3 One Piece : croise deux critères par case",
    metaDescription:
      "Une grille de neuf cases à remplir avec des personnages de One Piece : chaque case croise deux critères, comme un équipage et un type de fruit.",
    intro:
      "Trois critères en ligne, trois en colonne. Chaque case attend un personnage qui remplit les deux à la fois : un membre de la Marine qui a mangé un Logia, par exemple.",
    howTo: [
      "Clique sur une case, puis tape le nom d'un personnage qui remplit ses deux critères.",
      "Tu n'as qu'un essai par case, et un personnage ne sert qu'une fois.",
      "À la fin, les cases manquées montrent une réponse possible. Un point par case juste.",
    ],
    faq: [
      {
        question: "Y a-t-il une seule bonne réponse par case ?",
        answer: "Non : toute réponse qui remplit les deux critères est acceptée. En facile, chaque case a plusieurs réponses connues ; en expert, parfois une seule.",
      },
      {
        question: "Quels critères peut-on rencontrer ?",
        answer: "En ligne, une affiliation, un groupe, une mer d'origine, un arc ou l'initiale du nom. En colonne, un type de fruit, un haki, une prime, un genre, une race, une taille ou un âge.",
      },
      SPOILER_FAQ,
    ],
  },
  "recrute-ton-equipage": {
    metaTitle: "Recrute ton équipage : classe dix primes One Piece à l'aveugle",
    metaDescription:
      "Dix personnages primés tirés un à un, dix postes du capitaine au mousse : place chacun sans connaître les suivants, de la plus grosse prime à la plus petite.",
    intro:
      "Dix personnages se présentent un à un. Tu donnes à chacun un poste, du capitaine au mousse, sans savoir qui viendra ensuite. L'équipage idéal range les primes de la plus haute à la plus basse.",
    howTo: [
      "Regarde le personnage tiré, puis clique sur le poste que tu lui donnes : le capitaine doit avoir la plus grosse prime, le mousse la plus petite.",
      "Un poste donné ne se reprend pas.",
      "À la fin, les primes sont dévoilées : 5 points pour un personnage au bon poste, un de moins par poste d'écart. Maximum : 50 points.",
    ],
    faq: [
      {
        question: "Les primes sont-elles affichées pendant la partie ?",
        answer: "Non, seulement à la fin : c'est ta connaissance des primes qui fait la différence.",
      },
      {
        question: "Comment sont comptés les points ?",
        answer: "Le personnage à la plus grosse prime devrait être capitaine, le suivant second, et ainsi de suite. Chaque personnage rapporte 5 points au bon poste, 4 à un poste d'écart, jusqu'à 0 à cinq postes d'écart.",
      },
      SPOILER_FAQ,
    ],
  },
  "la-route-de-grand-line": {
    metaTitle: "La Route de Grand Line : traverse One Piece arc par arc",
    metaDescription:
      "Une île par arc, dans l'ordre de l'histoire, une question par île. Trois vies, un boss toutes les cinq îles : jusqu'où iras-tu sur la route de Grand Line ?",
    intro:
      "Une île par arc, de Romance Dawn jusqu'où tu en es. Sur chaque île, une question sur les personnages qui y apparaissent. Trois vies pour aller le plus loin possible.",
    howTo: [
      "Réponds à la question de l'île : une bonne réponse la conquiert, une erreur coûte une vie.",
      "Toutes les cinq îles, un boss : le rater coûte deux vies, le battre en rend une.",
      "La traversée s'arrête quand tu n'as plus de vie, ou au bout de la route. Un point par île conquise.",
    ],
    faq: [
      {
        question: "Combien d'îles compte la route ?",
        answer: "Une par arc du manga, ou par arc déjà adapté si tu joues en mode anime : une trentaine en tout.",
      },
      {
        question: "Sur quoi portent les questions ?",
        answer: "Sur les personnages qui apparaissent pour la première fois dans l'arc de l'île : leur affiliation, leur origine, leur haki, l'orthographe de leur nom.",
      },
      SPOILER_FAQ,
    ],
  },
  "den-den-devin": {
    metaTitle: "Den Den Devin : l'escargophone devine ton personnage One Piece",
    metaDescription:
      "Pense à un personnage de One Piece, sans le dire : l'escargophone te pose jusqu'à vingt questions sur son équipage, son fruit ou sa prime, puis devine de qui il s'agit.",
    intro:
      "Pense à un personnage, sans le dire. L'escargophone te pose des questions (son équipage, son fruit, sa prime, son origine) et finit par proposer un nom.",
    howTo: [
      "Pense à un personnage de One Piece.",
      "Réponds à chaque question par Oui, Non ou Je ne sais pas.",
      "Après vingt questions au plus, l'escargophone propose un nom. S'il se trompe trois fois, il s'avoue vaincu et te montre où vos réponses divergent.",
    ],
    faq: [
      {
        question: "Ce jeu rapporte-t-il des Berrys ?",
        answer: "Non : c'est toi qui dis si l'escargophone a trouvé, le site ne peut pas le vérifier. Il se joue pour le plaisir.",
      },
      {
        question: "Pourquoi l'escargophone se trompe-t-il parfois ?",
        answer: "Il ne connaît d'un personnage que sa fiche : affiliation, fruit, haki, prime, origine, taille, âge. Deux personnages secondaires aux fiches identiques sont pour lui indiscernables : il propose alors le plus connu.",
      },
      SPOILER_FAQ,
    ],
  },
};
