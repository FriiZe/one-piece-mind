# OnePieceMind — Plan

Site de mini-jeux One Piece, gratuit, jouable dans le navigateur, dans l'esprit de [PokeMind](https://pokemind.fr/) : un gros catalogue de jeux courts, une méta-progression (monnaie, collection, équipage), du multijoueur et du classé.

## 1. Décisions prises

| Sujet | Décision |
|---|---|
| Périmètre | Complet façon PokeMind : comptes, économie, collection, multi, classé, marché |
| Spoilers | Choix au lancement de chaque jeu : « à jour sur l'anime » ou « à jour sur le manga » (mémorisé ensuite) |
| Jeux incertains retenus | Rires et voix, GeoPiece |
| Jeux écartés | Blindtest openings, jeux sur le TCG |
| Hébergement | Tout sur Vercel, multijoueur compris |
| Référencement | Prioritaire : une page indexable par jeu |

## 2. Architecture

**Stack** : Next.js (App Router) + TypeScript + Tailwind, déployé sur Vercel. Next.js plutôt que React + Vite parce qu'il donne le rendu statique par page (référencement) et les routes serveur dans le même projet.

| Brique | Choix | Remarque |
|---|---|---|
| Pages | Génération statique pour l'accueil, le catalogue, `/jeux/[slug]`, le wiki | Le jeu lui-même est un composant client chargé dans la page |
| Base de données | Postgres Neon (Marketplace Vercel) + Prisma | Même duo que `one-piece-league` |
| Auth | Comptes créés sur le site (pseudo + mot de passe), et mode invité | Progression invitée en local, reprise à l'inscription. Discord et Google plus tard |
| Temps réel | Interrogation régulière du serveur, état des salons dans Postgres | Ni WebSocket ni Redis pour l'instant, voir risque n°2 |
| Fichiers | Vercel Blob (images, audio) | |
| Tâches planifiées | Vercel Cron | Tirage quotidien, boss hebdo, fin de saison classée |
| Tests | Vitest (générateurs de manches), Playwright (parcours clés) | |

**Moteur de jeu commun.** Chaque mini-jeu est un module qui déclare :

- `meta` : slug, titre, catégorie, description, texte de référencement, difficultés ;
- `generateRound(seed, pool, options)` : fonction pure qui fabrique une manche à partir du jeu de données filtré ;
- `checkAnswer(round, answer)` ;
- un composant React d'affichage.

Le cadre autour (chrono, score, combo, écran de résultat, partage, gain de Berrys) est écrit une seule fois. Ajouter un jeu revient à écrire un générateur et un composant.

**Triche.** Les jeux tournent dans le navigateur. En fin de partie, le jeu envoie la graine du tirage et les réponses données ; le serveur rejoue la partie, recalcule le score et attribue les gains (une fois par partie, avec un plafond journalier). Le classé (phase 5) demandera des manches générées par le serveur.

## 3. Données

Il n'existe pas d'équivalent de PokéAPI aussi complet pour One Piece. Le jeu de données est donc un actif du projet, versionné dans le dépôt (`data/*.json`, validé par Zod).

- **Sources** : [api-onepiece.com](https://api-onepiece.com/) pour la liste et les noms français (personnages, fruits, équipages, arcs), complétée par les infobox du [One Piece Wiki](https://onepiece.fandom.com/) (CC BY-SA) pour les premières apparitions, l'historique des primes, les surnoms, les origines et les affiliations. Curation manuelle par-dessus (`data/overrides/`).
- **Entités** : personnages, fruits du démon, équipages et organisations, îles, arcs et sagas, techniques, armes, navires, citations.
- **Champs personnage** : nom (FR / EN / romaji), surnom, genre, race, origine, taille, âge, affiliations, rôle, fruit, haki, prime, statut, première apparition (chapitre et épisode).
- **Volume visé** : environ 300 personnages bien renseignés pour démarrer, puis élargissement.

**Gestion des spoilers.** Chaque entité porte sa première apparition (chapitre + épisode). Les faits qui évoluent (prime, fruit révélé, affiliation, statut) sont stockés en versions datées par chapitre. Une constante `ANIME_CUTOFF_CHAPTER` indique jusqu'où l'anime a adapté le manga ; le mode « anime » ne voit que ce qui précède. Elle se met à jour à la main quand l'anime avance.

**Images et sons.** À constituer : portraits, silhouettes (générées par script à partir des portraits détourés), Jolly Rogers, dessins de fruits, carte du monde, extraits de rires et de voix.

## 4. Catalogue : 45 mini-jeux

Lots : **A** = 10 jeux phares pour la mise en ligne, **B** = le gros du catalogue, **C** = jeux lourds (ressources ou logique spécifiques).

### À l'œil (9)

| # | Jeu | Principe | Lot |
|---|---|---|---|
| 1 | Silhouette | Reconnaître un personnage à son ombre, réponse libre | A |
| 2 | Silhouette QCM | Même chose avec 4 propositions | B |
| 3 | Zoom extrême | Un détail très agrandi qui dézoome peu à peu | B |
| 4 | Révélation | Image pixelisée qui se précise avec le temps | A |
| 5 | Avis de recherche | L'affiche sans le nom ni la photo : deviner à partir de la prime et du surnom | A |
| 6 | Jolly Roger | Retrouver l'équipage à partir de son pavillon | A |
| 7 | Avant / après l'ellipse | Associer un personnage à sa version d'avant ou d'après | B |
| 8 | Fruit du démon | Reconnaître un fruit à son dessin | B |
| 9 | Mémo | Paires à retrouver : personnage ↔ fruit, personnage ↔ pavillon | B |

### À l'oreille (2)

| # | Jeu | Principe | Lot |
|---|---|---|---|
| 10 | Rires | Reconnaître un personnage à son rire. Abandonné : la version écrite a été retirée, la version audio ne se fera pas | C |
| 11 | Voix et répliques | Extrait audio court, deviner qui parle | C |

### Mots et indices (8)

| # | Jeu | Principe | Lot |
|---|---|---|---|
| 12 | OnePiecedle | Personnage mystère du jour ; chaque essai indique ce qui est juste (genre, affiliation, type de fruit, haki, prime, taille, origine, premier arc) | A |
| 13 | Wordle | Trouver un nom en 6 essais | B |
| 14 | Anagramme | Remettre les lettres d'un nom dans l'ordre | B |
| 15 | Les indices | Indices du plus vague au plus précis ; moins on en utilise, plus on gagne | B |
| 16 | Qui a dit ça ? | Attribuer une citation | B |
| 17 | Surnoms | « Le Chirurgien de la mort » → Law | B |
| 18 | Orthographe | Écrire sans faute les noms difficiles | B |
| 19 | Emojis | Deviner un personnage ou un arc à partir d'emojis | B |

### Primes et mesures (6)

| # | Jeu | Principe | Lot |
|---|---|---|---|
| 20 | Plus ou moins | La prime de B est-elle plus haute ou plus basse que celle de A ? En série | A |
| 21 | Le classement | Trier 5 personnages par prime, taille ou âge | A |
| 22 | Devine la prime | Estimer une prime, points selon la proximité | B |
| 23 | Grand ou vieux | Qui est le plus grand, le plus âgé | B |
| 24 | Première apparition | Deviner le chapitre ou l'épisode d'entrée d'un personnage | B |
| 25 | Prime d'équipage | Estimer la prime totale d'un équipage | B |

### Savoir (11)

| # | Jeu | Principe | Lot |
|---|---|---|---|
| 26 | Type de fruit | Paramecia, Zoan ou Logia | A |
| 27 | Qui a mangé ce fruit ? | Du fruit vers son utilisateur, et l'inverse | A |
| 28 | Équipage | À quelle organisation appartient ce personnage | B |
| 29 | Haki | Quels hakis maîtrise ce personnage | B |
| 30 | Techniques | À qui appartient cette attaque | B |
| 31 | Armes et sabres | Du sabre à son porteur | B |
| 32 | Navires | Du navire à son équipage | B |
| 33 | Origine et race | Mer d'origine, race | B |
| 34 | Chronologie | Remettre des arcs ou des événements dans l'ordre | B |
| 35 | Dans quel arc ? | Situer un personnage ou un événement | B |
| 36 | Vrai ou faux | Affirmations générées à partir des données | B |

### Défis (9)

| # | Jeu | Principe | Lot |
|---|---|---|---|
| 37 | Mode aléatoire | Enchaînement de manches tirées dans tous les jeux | B |
| 38 | Trouve-les tous | Citer tous les membres d'un groupe en temps limité (Mugiwara, Corsaires, Supernovas, Amiraux...) | A |
| 39 | La Route de Grand Line | Parcours d'île en île, difficulté croissante, un boss par arc, vies limitées | C |
| 40 | Den Den Devin | Le jeu devine le personnage auquel tu penses en posant des questions | C |
| 41 | GeoPiece | Placer une île sur la carte, ou retrouver l'ordre de la route | C |
| 42 | Grille 3×3 | Remplir une grille en croisant deux critères (« Sabreur » × « East Blue ») | C |
| 43 | Connexions | Regrouper 16 personnages en 4 familles cachées | C |
| 44 | Recrute ton équipage | Tirage de personnages au hasard, composer l'équipage le plus fort poste par poste | C |
| 45 | Duo, Carré ou Cash | Avant chaque réponse, choisir son risque : deux propositions, quatre, ou aucune | B |

## 5. Méta-jeu

Transposition des systèmes de PokeMind.

| PokeMind | OnePieceMind |
|---|---|
| PokéDollars | **Berrys**, gagnés à chaque partie selon le score et la difficulté |
| Capture + Pokédex | **Recrutement** : après une partie, chance d'obtenir l'avis de recherche d'un personnage. La collection se remplit |
| Chromatiques | **Avis dorés**, variantes rares d'un même personnage |
| Équipe de 6 avec bonus | **Équipage** : 10 postes (capitaine, sabreur, navigateur, tireur, cuisinier, médecin, archéologue, charpentier, musicien, timonier), chaque poste donne un bonus (combo, chrono, joker...) |
| Rang du joueur | **Ta propre prime**, qui monte avec tes résultats |
| 5 rangs classés | Mousse → Rookie → Supernova → Corsaire → Empereur |
| Boss mondial hebdo | **Raid** : toute la communauté contre un Empereur ou un Amiral, une fois par semaine |
| Marché | Échange de doublons entre joueurs, avec taxe |
| Boutique | Cosmétiques payés en Berrys uniquement (pavillon, navire, cadre de profil) |
| Quiz créés par les joueurs | Idem, avec file de modération |
| Amis, chat | Amis d'abord ; le chat en dernier, il impose de la modération |

## 6. Multijoueur

Mode salon façon Kahoot : un hôte crée une partie, partage un code, choisit les jeux et le mode spoiler ; tout le monde répond aux mêmes manches, classement en direct.

- Chaque navigateur interroge le serveur toutes les une à deux secondes ; l'état du salon vit dans la base Postgres. Pas de WebSocket ni de Redis : rien à ajouter à l'hébergement.
- Le serveur fait foi : il envoie la manche, reçoit les réponses, calcule les scores. La bonne réponse n'est envoyée qu'à la correction.
- Ensuite : duel classé 1 contre 1 (« Davy Back Fight ») avec file d'attente.

## 7. Référencement

- Une page statique par jeu (`/jeux/onepiecedle`...) avec un vrai texte : règles, astuces, questions fréquentes.
- Pages de catégories et wiki des mécaniques. Pas de page « réponse du jour » : elle attire du trafic mais tue l'intérêt du défi quotidien.
- Métadonnées, images de partage générées, plan du site, données structurées (`VideoGame`, `FAQPage`).
- Français à la racine, anglais sous `/en/...` : les deux langues sont en ligne, chaque page annonce ses deux versions (`hreflang`). Voir README, section « Langues ».
- Partage des résultats en grille d'emojis, comme Wordle : c'est le principal canal d'acquisition de ce type de site.
- Mettre en ligne dès la fin de la phase 1 : l'indexation prend des semaines, autant la démarrer tôt.

## 8. Feuille de route

| Phase | Contenu | Résultat |
|---|---|---|
| 0. Fondations | Projet Next.js, charte graphique, import et validation du jeu de données, marquage spoilers, génération des silhouettes | Données fiables, site vide déployé |
| 1. Moteur + lot A | Moteur de jeu commun, choix anime / manga, 10 jeux phares, défi quotidien, pages de référencement | **Mise en ligne publique** |
| 2. Comptes et économie | Auth, Berrys, recrutement et collection, équipage et bonus, profil, correction côté serveur | La boucle « jouer → gagner → collectionner » |
| 3. Lot B | Les 26 jeux du lot B, objectifs par jeu, défis hebdo | Catalogue de 36 jeux |
| 4. Multijoueur | Salons à code, amis, classement en direct | Parties entre amis |
| 5. Compétitif et communauté | Classé, raid hebdo, marché, boutique, quiz des joueurs + modération | Parité avec PokeMind |
| 6. Lot C | Route de Grand Line, GeoPiece, Den Den Devin, grille, connexions, rires et voix | 45 jeux |

Le lot C peut s'intercaler plus tôt, jeu par jeu, selon l'envie.

### Avancement

**Phase 0 : faite**, sauf le déploiement sur Vercel et les portraits (aucune image dans le projet, voir section 10).

**Phase 1 : 9 jeux en ligne.**

- Fait : moteur de jeu commun, choix anime / manga avant la première partie, défi quotidien (OnePiecedle), trois niveaux de difficulté, records conservés dans le navigateur, pages de jeu référençables (règles, questions fréquentes, données structurées, image de partage, plan du site).
- Jeux en ligne : OnePiecedle, Révélation, Zoom extrême, Avis de recherche, Plus ou moins, Le classement, Type de fruit, Qui a mangé ce fruit ?, Trouve-les tous.
- Images : 481 portraits officiels, pris sur AniList. Le One Piece Wiki bloque les téléchargements automatisés.
- Changements par rapport au plan :
  - « Zoom extrême » (prévu au lot B) remplace « Silhouette » : le détourage automatique des portraits ne donne pas de silhouettes exploitables.
  - « Jolly Roger » attend une source de pavillons.
  - « Avis de recherche » donne en indices l'affiliation, la mer d'origine, l'arc et l'initiale, et non le surnom (les surnoms ne sont disponibles qu'en anglais).
- Reste : la mise en ligne publique.

**Phase 2 : faite et en ligne.**

- Fait : Berrys gagnés à chaque partie, plafond journalier, recrutement après une bonne partie, taverne (recrutement payant), collection d'avis de recherche avec raretés et avis dorés, équipage de dix postes avec bonus, prime et rang du joueur, comptes, reprise de la progression d'invité à l'inscription.
- Décisions prises en cours de route :
  - Vérification des parties : le serveur rejoue la partie à partir des réponses envoyées, plutôt que de générer chaque manche lui-même. On ne peut pas inventer un score ; un tricheur qui lit les données du navigateur peut en revanche bien répondre.
  - Comptes : pseudo et mot de passe créés sur le site, sans Discord ni Google pour l'instant. Sans adresse e-mail, pas de récupération de mot de passe.
  - Bonus d'équipage : uniquement des bonus de gains. Les règles des jeux ne changent pas, donc les scores restent comparables.
- En ligne sur https://one-piece-mind.vercel.app, avec une base Neon : les comptes sont ouverts.

**Phase 3 : 21 jeux du lot B, objectifs et défis de la semaine.**

- Jeux ajoutés : Mémo, Wordle, Anagramme, Les indices, Surnoms, Orthographe, Emojis, Devine la prime, Grand ou vieux, Première apparition, Prime d'équipage, Équipage, Haki, Techniques, Armes et sabres, Navires, Origine et race, Chronologie, Dans quel arc ?, Vrai ou faux, Mode aléatoire. Le site compte 30 jeux.
- Objectifs : six par jeu (jouer 1, 10, 50 parties ; marquer 50 %, 80 %, 100 % des points), avec une prime chacun.
- Défis de la semaine : trois défis communs à tous, renouvelés le lundi, sur la page « Défis ».
- Contenus rédigés à la main pour cinq jeux (`data/curated/`) : surnoms français, techniques, armes, navires, devinettes en emojis. À relire.
- Jeux du lot B non livrés, faute de matière :
  - Silhouette QCM, Avant / après l'ellipse, Fruit du démon (au dessin) : pas d'images adaptées.
  - Qui a dit ça ? : pas de recueil de citations.

**Phase 4 : salons multijoueur et amis.**

- Salons : un hôte crée un salon (mode spoiler, difficulté, 5 à 15 questions, 10 à 20 secondes par question, quiz dans lesquels piocher) et partage un code de cinq caractères ou un lien. Jusqu'à 20 joueurs, avec ou sans compte.
- Partie : tout le monde reçoit la même question en même temps ; une bonne réponse rapporte 500 points, plus jusqu'à 500 points de rapidité. Correction et classement après chaque question, podium à la fin, revanche possible dans le même salon.
- Berrys : les joueurs connectés en gagnent selon leur score et leur place, dans la limite du plafond journalier. Une partie en solitaire ne rapporte rien.
- Amis : demande par pseudo, acceptation, retrait, et invitation d'un ami dans un salon (affichée sur sa page « Multi » et sur son profil).
- Changement par rapport au plan : interrogation régulière du serveur à la place des WebSockets et de Redis. Plus simple et suffisant pour un quiz ; le délai d'affichage est d'une à deux secondes.
- Limites : les jeux de salon sont les onze quiz à choix, pas les autres jeux. Pas de chat. Le duel classé reste en phase 5.

**Retours de joueurs et quiz de la communauté** (après la phase 4).

- Collection : fiche détaillée de chaque avis de recherche ; les doublons se défont contre des Berrys (100 à 1 500 ฿ selon la rareté, trois fois plus pour un doré), un par un ou tous d'un coup. On garde toujours un exemplaire.
- Équipage : les postes se composent en images, en choisissant un avis dans sa collection.
- Jeux : portraits dans les propositions et à la correction ; Devine la prime et les autres estimations acceptent un nombre tapé au clavier (« 320 M », « 1,5 Md ») ; Anagramme reprend la main sur le champ à chaque manche ; Trouve-les tous signale les groupes déjà complétés.
- Nouveau jeu, « Duo, Carré ou Cash » : 1, 3 ou 5 points selon le risque choisi. En Cash, la réponse est écrite ; la casse, les accents et une faute de frappe sont tolérés. Le site compte 31 jeux.
- Quiz de la communauté (prévus en phase 5, avancés) : un joueur connecté écrit un quiz de 5 à 30 questions, les autres y jouent en Duo, Carré ou Cash.
  - Publication immédiate, création réservée aux comptes, 20 quiz par auteur et 5 par jour.
  - Modération : signalement par les joueurs connectés, masquage automatique au troisième signalement, suppression et remise en ligne par les administrateurs (`ADMIN_USERNAMES`).
  - Berrys : jusqu'à 150 ฿ la première fois qu'on termine le quiz d'un autre joueur, dix quiz récompensés par jour au plus, dans le plafond journalier. Limite assumée : deux comptes suffisent à contourner la règle « pas son propre quiz », d'où la petite somme.
  - Les quiz ne sont pas proposés aux moteurs de recherche : leur contenu n'est pas relu avant publication.
- Reste à faire : modifier un quiz déjà publié, jouer un quiz de la communauté en salon multijoueur.
- Classements : page `/classement` (les comptes par prime, cinquante premiers et le joueur connecté), et sur chaque page de jeu la meilleure partie de chaque joueur sur la journée, la semaine ou le mois, à l'heure de Paris (`/api/leaderboard`). Seules les parties des comptes, validées par le serveur, sont classées.
- Échanges et marché réservés aux comptes qui ont joué : il faut avoir terminé une partie, validée par le serveur, sur trois jours différents (`EXCHANGE_MIN_PLAY_DAYS`). Cela coupe la boucle « compte jetable, booster, échange vers le compte principal ». Le critère n'est ni la prime ni la collection : elles se reprennent d'un état d'invité, que le navigateur déclare. Reste ouvert : la reprise d'invité elle-même accepte jusqu'à 100 000 ฿ et 50 exemplaires de n'importe quel avis.
- Équipages enregistrés : cinq compositions au plus, gardées de côté sous un nom et remises en place d'un geste (colonne `User.savedCrews`, et dans le navigateur pour un invité).
- Écriture d'un quiz : « Enregistrer le brouillon » en dépose une copie dans le compte (dix au plus, table `QuizDraft`), reprenable depuis « Mes brouillons » sur n'importe quel appareil et retirée à la publication ; ce qui s'écrit reste aussi gardé dans le navigateur. Deux flèches déplacent la question choisie d'un rang. « Tester » fait jouer les questions déjà prêtes, sans rien enregistrer.
- Vignette et langue d'un quiz : à la création, l'auteur peut joindre une image et indique si le quiz est rédigé en français ou en anglais. La liste affiche la vignette et une étiquette de langue, et se filtre par langue.
  - L'image est recadrée en 16:9 et réduite à 640 × 360 dans le navigateur, puis gardée en base (table `QuizThumbnail`) et servie par `/api/quizzes/<id>/thumbnail`. Vercel Blob n'est pas utilisé.
  - Les quiz publiés avant ce champ sont marqués en français. Une vignette n'est pas relue avant publication : comme le texte, elle relève des signalements.
- Notifications : une cloche dans l'en-tête compte les demandes d'ami, les invitations dans un salon et, pour un administrateur, les quiz masqués. Le compte est mis en avant : bouton « Connexion » pour les visiteurs, pseudo et icône une fois connecté.
- Révélation et Zoom extrême : l'image n'avance plus avec le temps, seulement après une proposition (ou une demande d'en voir plus, qui coûte autant qu'une erreur). Le palier est déduit par le serveur du nombre d'erreurs.
- Boutique (prévue en phase 5, avancée) : elle remplace la taverne. Une recrue pour 1 500 ฿, ou un booster de cinq avis pour 6 000 ฿, ouvert carte par carte : trois communes ou peu communes, une quatrième parfois rare, une dernière rare ou légendaire. Le halo de rareté d'une carte n'apparaît qu'au survol.
- Traits d'équipage, façon TFT : les membres d'une même affiliation activent un trait à 3, 5 puis 7 membres (Barbe Blanche : Berrys ; Armée révolutionnaire : réduction à la boutique ; Roger : avis dorés...). Ils remplacent l'ancien bonus unique « trois membres de la même affiliation ».
- Six jeux du lot C, ceux qui ne demandent ni images ni sons nouveaux : Rires (version écrite), Connexions, Grille 3×3, Recrute ton équipage, La Route de Grand Line, Den Den Devin. Le site compte 37 jeux.
  - Den Den Devin ne rapporte ni Berrys ni objectifs : c'est le joueur qui dit si l'escargophone a trouvé, le serveur ne peut pas le vérifier.
  - Recrute ton équipage est devenu un classement à l'aveugle : dix primes tirées une à une, à placer du capitaine au mousse.
  - Restent en attente, faute de matière : Silhouette, Silhouette QCM, Jolly Roger, Avant / après l'ellipse, Fruit du démon (dessin), Voix et répliques, GeoPiece, Qui a dit ça ?
- Glisser-déposer dans les jeux où l'on range : Le classement, Chronologie (à la souris, ou au doigt par la poignée ; les flèches restent pour le clavier) et Recrute ton équipage (à la souris).
- Récompenses recentrées sur le retour quotidien : seuls le défi du jour et cinq jeux tirés chaque jour rapportent des Berrys et des recrues, une fois chacun, à partir de la moitié des points. La sélection est mise en avant sur l'accueil, la liste des jeux et la page Défis ; chaque page de jeu dit s'il paie aujourd'hui. 500 ฿ sont offerts à l'inscription. Les salons multijoueur et les quiz de la communauté gardent leurs propres gains.
- Échanges entre amis : un avis contre un avis, sur proposition acceptée. Reste à faire : échanger plusieurs avis à la fois, choisir de donner l'exemplaire doré plutôt que l'ordinaire.

**Phase 5 : classé, raid, marché et cosmétiques.** Les quiz de la communauté et la boutique avaient été avancés.

- Classé « Davy Back Fight » (`/classe`) : duel à un contre un par file d'attente, dix questions de dix secondes, cote Elo, cinq ligues, une saison par mois avec prime de ligue et titres pour les deux plus hautes.
- Raid de la semaine (`/raid`) : un Empereur ou un Amiral pour toute la communauté, trois assauts de dix questions par jour, des dégâts renforcés par l'équipage, un butin pour chaque participant si l'adversaire tombe.
- Marché (`/marche`) : vente d'un exemplaire en trop à prix borné, 10 % de taxe, dix annonces par joueur.
- Cosmétiques à la boutique : cadres d'avis de recherche, pavillons, navires et titres, visibles sur le profil, l'en-tête du navire et les classements.
- Décisions prises en cours de route :
  - Les ligues ne s'appellent pas Mousse à Empereur : ces cinq rangs sont déjà ceux de la prime du joueur. Elles vont d'East Blue à Laugh Tale.
  - Le classé se joue en mode anime, quelle que soit la préférence du joueur : on ne choisit pas son adversaire, il ne doit pas pouvoir être spoilé. La file est séparée par langue, parce que les questions le sont.
  - Aucune tâche planifiée : la saison et le raid changent à la première requête qui le constate, comme les défis de la semaine. Vercel Cron n'est pas utilisé.
  - Le duel réutilise les salons : les questions sont déjà tirées par le serveur, la bonne réponse ne part qu'à la correction.
  - Les points de vie du raid suivent le nombre de joueurs actifs, pour qu'il reste battable par une petite communauté.
  - Le marché ne vend que des exemplaires en trop : personne ne se retrouve sans un avis qu'il avait.
- Limites assumées :
  - Deux comptes peuvent s'entendre pour monter une cote ; la file ne les réunit plus après cinq duels dans la journée.
  - En raid, le chrono de chaque question n'est tenu que par le navigateur ; le serveur contrôle la durée totale de l'assaut.
  - Les prix bornés et la taxe limitent le transfert de Berrys entre comptes par une vente arrangée, sans l'empêcher.
- Reste à faire : le chat (prévu en dernier, il impose de la modération), l'historique des saisons passées, des annonces qui expirent.

**Retours après la phase 5.**

- Les indices : barème sur 10 points par manche, jamais moins de 5 avant l'initiale, 2 avec l'initiale. Trouver avant l'initiale valide le jeu du jour.
- Rires est abandonné : le jeu, ses données et ses textes sont retirés. Le site compte 36 jeux.
- Quiz à choix : la plupart posent aussi leur question dans l'autre sens (du personnage vers sa technique, son arme, son surnom ; de l'organisation, de l'arc, de la mer ou de la race vers le personnage). Vrai ou faux a huit familles d'affirmations de plus. Orthographe fait aussi écrire des techniques et des armes, Grand ou vieux demande aussi le plus petit et le plus jeune.
- Contenus rédigés étoffés (`data/curated`) : techniques, surnoms, armes, navires, devinettes en emojis. Écrits de mémoire : à relire.
- Le surnom sert d'indice, juste avant l'initiale, dans Les indices et Avis de recherche. Emojis se joue désormais par difficulté. Mémo associe selon la partie le fruit, le surnom ou l'arme.
- Critères partagés par Connexions, Grille et Den Den Devin : hakis un à un, Zoan antique et mythique, paliers de prime, de taille et d'âge, initiale du nom (jamais demandée par Den Den Devin). Sept groupes de plus pour Trouve-les tous.
- Historique des propositions : Les indices, Emojis, Avis de recherche, Révélation et Zoom extrême listent sous le champ de saisie les noms déjà écartés sur la manche.
- Défis (`/defis`) : quatre défis quotidiens s'ajoutent aux jeux du jour et aux défis de la semaine, passés de trois à six. Chaque jour : jouer, valider des jeux du jour, marquer 80 % des points dans un jeu de la sélection, et un objectif tiré dans un autre jeu (y jouer, y marquer 80 %, y réussir un sans-faute). Les défis de score ne portent que sur les jeux où ils se jouent vraiment (`SCORE_CHALLENGE_SLUGS`). La page liste aussi tous les objectifs, jeu par jeu. Elle a son lien dans l'en-tête et son onglet sur téléphone.
- Primes de score selon la difficulté : ×0,5 en facile, ×1 en normal, ×3 en expert, pour les objectifs de score et les défis « marquer 80 % ». Un objectif réussi ensuite à un niveau plus haut verse la différence. Les jeux sans niveau (`FIXED_DIFFICULTY_SLUGS`) gardent leur prime, et la difficulté annoncée par leur compte rendu est ignorée.
- Première apparition : barème au numéro près, sur 10 par personnage. Le numéro exact vaut 10, puis 9 jusqu'à 5 numéros d'écart, 8 jusqu'à 10, 7 jusqu'à 25, 6 jusqu'à 42, 5 jusqu'à 61 ; encore 2 points à 99, 1 jusqu'à 150. La moitié des points se garde jusqu'à 61 d'écart, pour que le jeu du jour reste gagnable. Le curseur avance d'un numéro par cran.

**À reprendre plus tard**

- Libellés français des surnoms ; les affiliations sont traduites (`src/lib/data/labels.ts`), avec un repli sur l'anglais pour les plus rares.
- Affiliation principale de chaque personnage : déduite de l'ordre du wiki, corrigée à la main pour une vingtaine de cas. À relire pour les personnages secondaires.
- Statut vivant / décédé : non daté, donc non filtré en mode anime.

## 9. Risques

1. **Droits d'auteur.** One Piece appartient à Shueisha et Toei. Un site de fans gratuit est en général toléré, mais les images officielles et surtout les extraits audio (rires, voix) sont les éléments les plus exposés. Mesures : aucun revenu tiré de la licence, mention de non-affiliation, retrait rapide sur demande, version écrite des rires en premier.
2. **Temps réel sur Vercel.** Les salons interrogent le serveur toutes les une à deux secondes : chaque joueur présent coûte donc des appels de fonction et des requêtes en base tant que le salon est ouvert. À surveiller si la fréquentation monte. Les WebSockets natifs de Vercel (bêta publique depuis juin 2026, connexion limitée à 30 minutes et liée à une seule instance, d'où un Redis pour relier les instances), Ably ou Pusher restent les solutions de rechange, sans changer d'hébergeur.
3. **Qualité des données.** C'est le plus gros chantier caché : primes par époque, premières apparitions, marquage spoilers. Une erreur de marquage spoile un joueur. Prévoir des tests automatiques sur le jeu de données.
4. **Économie et triche.** Un marché entre joueurs attire les abus ; d'où la correction serveur et des plafonds de gains journaliers.

## 10. Points à trancher plus tard

- Nom et domaine définitifs.
- Défi quotidien : mis en place avec un seul tirage « sans spoiler anime » pour tout le monde. À revoir si tu préfères deux tirages distincts.
- Origine des images : officielles (décidé). Reste à trouver des portraits détourés pour « Silhouette » et des pavillons pour « Jolly Roger ».
