# OnePieceMind

Site de mini-jeux One Piece (nom provisoire). Le plan complet du projet est dans [PLAN.md](PLAN.md).

## Démarrer

```bash
npm install
npm run dev
```

Le site tourne sur http://localhost:3000. Le jeu de données généré (`data/generated/`) est versionné : aucune étape d'import n'est nécessaire pour lancer le site.

Sans base de données, le site fonctionne en mode invité : la progression reste dans le navigateur et les comptes sont fermés. Pour ouvrir les comptes en local (Docker requis) :

```bash
cp .env.example .env
npm run db:up
npm run db:deploy
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` / `test` | Qualité : ESLint, TypeScript, Vitest |
| `npm run db:up` | Lance la base Postgres locale (Docker, port 5433) |
| `npm run db:migrate` | Crée et applique une migration après une modification de `prisma/schema.prisma` |
| `npm run db:deploy` | Applique les migrations existantes (base locale neuve, production) |
| `npm run data:refresh` | Retélécharge les sources et reconstruit le jeu de données |
| `npm run data:build` | Reconstruit le jeu de données à partir des sources déjà téléchargées |
| `npm run images:fetch` | Télécharge les portraits manquants et met à jour leur inventaire |
| `npm run images:silhouettes` | Génère les silhouettes à partir de portraits détourés fournis à la main |

## Jeux

```
src/games/
├── engine/        hasard reproductible, défi du jour, comparaison des saisies, difficulté
├── cards.ts       données compactes envoyées au navigateur, ramenées au mode du joueur
├── content.ts     textes des pages de jeu (règles, questions fréquentes, métadonnées)
├── ui/            éléments communs : lanceur, choix du mode spoiler, saisie assistée, quiz
├── qcm/           quiz à choix : douze jeux, un générateur de questions chacun
├── estimate/      estimation d'un nombre au curseur : trois jeux
├── clues/         personnage à retrouver par indices successifs : deux jeux
└── <jeu>/         logic.ts (fonctions pures, testées) et Game.tsx (affichage)
```

La plupart des jeux appartiennent à une famille qui partage son déroulé, son composant et la forme de son compte rendu. Ajouter un quiz à choix revient à écrire un générateur dans `src/games/qcm/logic.ts`.

Les jeux tournent dans le navigateur. Les données (`/data/jeux.json`, générées à la compilation) sont téléchargées une fois, puis filtrées selon le mode du joueur par `resolveGameData` : un jeu ne reçoit jamais un personnage ou une information que le joueur n'a pas encore vus.

Pour ajouter un jeu :

1. écrire sa logique (un générateur dans une famille existante, ou `src/games/<slug>/logic.ts`) et ses tests ;
2. écrire `src/games/<slug>/Game.tsx` si aucune famille ne convient ;
3. ajouter le slug à `LIVE_SLUGS` (`src/lib/games/catalog.ts`) : TypeScript réclame alors son composant dans `GameRunner.tsx`, ses textes dans `content.ts` et son barème dans `src/lib/economy/rewards.ts` ;
4. déclarer la forme de son compte rendu et son recalcul dans `src/games/report.ts`.

La page `/jeux/<slug>`, son image de partage et son entrée dans le plan du site sont créées automatiquement.

## Économie et comptes

```
src/lib/economy/   règles pures : gains, recrutement, bonus d'équipage, prime du joueur
src/lib/player/    état du joueur côté navigateur, et actions envoyées au serveur
src/lib/server/    base de données, mots de passe, sessions, enregistrement des récompenses
prisma/            schéma et migrations
```

- **Boutique.** Les Berrys s'y dépensent en avis de recherche : une recrue à l'unité (`buyRecruit`, 1 500 ฿) ou un booster de cinq avis (`buyBooster`, 6 000 ฿) dont chaque carte a ses propres chances (`BOOSTER_SLOTS`) : trois communes ou peu communes, une quatrième parfois rare, une dernière rare ou légendaire. Le tirage a lieu sur le serveur à l'achat ; l'ouverture animée (`src/components/PackOpening.tsx`) ne fait que dévoiler des avis déjà acquis.
- **Traits d'équipage.** Les membres d'une même affiliation placés à des postes activent le trait de cette affiliation, à 3, 5 puis 7 membres (`TRAITS` dans `crew.ts`) : Berrys, réduction à la boutique, chances de recruter ou d'avis doré selon l'affiliation. Les affiliations sans trait propre partagent un trait plus modeste. Plusieurs traits se cumulent.
- **Échanges.** Deux amis échangent un avis contre un avis (`src/lib/server/trades.ts`, page `/echanges`). Rien ne bouge avant l'acceptation ; les deux avis changent alors de collection dans une même transaction. Un joueur qui donne son seul exemplaire le perd, y compris dans son équipage. Dix propositions en attente et vingt par jour au plus.
- **Doublons.** Un avis obtenu plusieurs fois peut être défait contre des Berrys (`sellDuplicates`), selon sa rareté. On garde toujours un exemplaire, le doré s'il y en a un. Ces Berrys ne comptent ni dans la prime du joueur ni dans le plafond journalier.
- **Objectifs et défis.** Chaque jeu a six objectifs (régularité et réussite), et trois défis communs à tous les joueurs changent chaque lundi (`objectives.ts`, `weekly.ts`). Leurs primes s'ajoutent aux gains de la partie qui les fait atteindre, hors plafond journalier.
- **Une seule implémentation des règles.** `src/lib/economy` est appliqué tel quel par le navigateur (invité) et par le serveur (compte) ; `tests/economy.test.ts` en fixe le comportement.
- **Vérification des parties.** En fin de partie, le jeu envoie un compte rendu (`src/games/report.ts`) : la graine du tirage et les réponses données, jamais un score. Le serveur rejoue la partie (`evaluateReport`), recalcule le score et attribue les gains. Une même partie n'est payée qu'une fois, et les gains sont plafonnés par jour. Limite assumée : un joueur qui lit les données dans son navigateur peut bien répondre ; ce qu'il ne peut pas faire, c'est inventer un score.
- **Comptes.** Pseudo et mot de passe, sans adresse e-mail : un mot de passe oublié ne peut donc pas être récupéré. Mots de passe hachés avec scrypt, sessions en base (seule l'empreinte du jeton est enregistrée), cookie `HttpOnly`, tentatives de connexion limitées. À la création du compte, la progression d'invité est reprise, avec des plafonds.
- **Les tests de `tests/server.test.ts`** écrivent dans la base locale ; ils sont ignorés sans `DATABASE_URL`.

## Quiz de la communauté

```
src/games/duo-carre-cash/  le jeu « Duo, Carré ou Cash » et son déroulé, partagé avec les quiz des joueurs
src/lib/quiz/              règles (ce qu'un joueur peut écrire, score, Berrys), types, appels du navigateur
src/lib/server/quizzes.ts  création, liste, parties, signalements, modération
src/components/quiz/       liste, formulaire de création, écran de jeu
```

- **Duo, Carré ou Cash.** Avant chaque réponse, le joueur choisit son risque : deux propositions (1 point), quatre (3 points) ou aucune (5 points). En Cash, la réponse tapée est comparée par `matchesAnswer` (`src/games/engine/text.ts`) : casse, accents et ponctuation ignorés, une faute de frappe tolérée, sauf si la saisie ressemble autant à une mauvaise réponse connue.
- **Écrire un quiz.** Réservé aux comptes : 5 à 30 questions, une bonne réponse, trois mauvaises et, au besoin, d'autres graphies acceptées en Cash. Le formulaire et le serveur valident avec le même schéma (`src/lib/quiz/rules.ts`) ; le texte est nettoyé avant d'être enregistré.
- **Modération.** Un quiz est public dès sa création. Un joueur connecté peut le signaler ; au troisième signalement, il est masqué. Les administrateurs voient les quiz masqués, peuvent les remettre en ligne (ils ne sont alors plus masqués automatiquement) ou supprimer n'importe quel quiz. Les pages de quiz ne sont pas indexées.
- **Administrateurs.** Leurs pseudos sont listés dans la variable d'environnement `ADMIN_USERNAMES`, séparés par des virgules.
- **Berrys.** Le serveur recalcule le score à partir des réponses envoyées. Seule la première partie terminée sur le quiz d'un autre joueur est payée (150 ฿ au plus), dix quiz par jour, dans le plafond journalier.
- **Les tests de `tests/retours.test.ts`** couvrent ces règles et, sur la base locale, le parcours complet d'un quiz.

## Multijoueur et amis

```
src/lib/multi/            règles (points, classement, Berrys), types, appels depuis le navigateur
src/lib/server/rooms.ts   salons : création, arrivée des joueurs, déroulé, réponses, récompenses
src/lib/server/friends.ts amis : demandes, acceptation, retrait
src/app/api/rooms/        routes interrogées par les navigateurs
src/components/multi/     page d'accueil du multijoueur et écran du salon
```

- **Pas de connexion permanente.** Chaque navigateur interroge `/api/rooms/<code>` toutes les une à deux secondes, avec le numéro de version qu'il connaît ; le serveur répond « rien de neuf » tant que le salon n'a pas changé. L'état du salon vit dans Postgres.
- **Pas de tâche de fond.** Le salon avance quand quelqu'un l'interroge : si le temps d'une question est écoulé, la requête qui le constate passe à la correction. Le numéro de version sert de verrou, deux requêtes simultanées ne font pas avancer le salon deux fois.
- **Le serveur fait foi.** Les questions sont tirées côté serveur à partir de la graine du salon ; la bonne réponse et les points de la question en cours ne partent qu'à la correction.
- **Joueurs sans compte.** À son arrivée, un joueur reçoit un ticket (identifiant et jeton) gardé dans son navigateur ; il le renvoie à chaque appel. Recharger la page ne fait pas quitter le salon.
- **Berrys.** Payés une seule fois par partie aux joueurs connectés, selon le score et la place, dans la limite du plafond journalier.
- **Notifications.** La cloche de l'en-tête compte les demandes d'ami reçues, les invitations dans un salon et, pour un administrateur, les quiz masqués à relire (`/api/notifications`). Elle est relue toutes les quarante-cinq secondes tant que l'onglet est visible ; le détail n'est chargé qu'à l'ouverture.
- **Ménage.** Les salons de plus de 24 heures sont supprimés à la création d'un nouveau salon.
- **Les tests de `tests/multi.test.ts`** jouent une partie complète et le parcours des amis sur la base locale ; ils sont ignorés sans `DATABASE_URL`.

### Mise en production

Le site est déployé sur Vercel (projet `one-piece-mind`, https://one-piece-mind.vercel.app) :

```bash
npx vercel --prod
```

- **Base de données** : Neon, créée depuis le Marketplace Vercel (`one-piece-mind-db`, région de Francfort), branchée sur l'environnement de production. Vercel fournit `DATABASE_URL` (connexion groupée, utilisée par le site) et `DATABASE_URL_UNPOOLED` (connexion directe, utilisée par les migrations).
- **Migrations** : appliquées pendant le build de production (`scripts/db/migrate-on-deploy.mjs`). Rien à lancer à la main.
- **Région** : les fonctions tournent à Francfort (`vercel.json`), à côté de la base.
- **Réglages locaux** : `.vercelignore` empêche l'envoi de `.env`, que la CLI n'écarte pas d'elle-même.
- **Administrateurs** : `ADMIN_USERNAMES` (pseudos séparés par des virgules) est à définir dans les variables d'environnement de production pour modérer les quiz de la communauté.
- **Adresse du site** : déduite du domaine de production ; `NEXT_PUBLIC_SITE_URL` ne sert qu'à en imposer une autre (domaine personnalisé).

Les préversions et le poste de développement ne sont pas reliés à la base de production : les préversions tournent en mode invité, le développement sur la base Docker locale.

## Jeu de données

```
data/
├── raw/         sources téléchargées (ignoré par git)
├── overrides/   corrections manuelles
└── generated/   fichiers utilisés par le site (versionnés)
```

Le pipeline tient en trois scripts (`scripts/data/`) :

1. `fetch-api.ts` télécharge [api-onepiece.com](https://api-onepiece.com/) : personnages, fruits, équipages, arcs, épisodes, îles, navires, sabres.
2. `fetch-wiki.ts` complète chaque personnage et chaque fruit avec l'infobox du [One Piece Wiki](https://onepiece.fandom.com/) (CC BY-SA) : première apparition, historique des primes, surnoms, origine, affiliations, et les catégories de la page (genre, race, haki).
3. `build.ts` fusionne le tout, applique `data/overrides/`, valide chaque fichier avec son schéma Zod (`src/lib/data/schema.ts`) et écrit `data/generated/`.

Contenus rédigés à la main (`data/curated/`) : surnoms en français, techniques, armes, navires et devinettes en emojis. Ils ne viennent d'aucune source importée ; les tests vérifient seulement que les personnages cités existent.

Corrections manuelles :

- `overrides/wiki-titles.json` : nom dans l'API → titre de la page wiki, quand il ne se déduit pas du nom (l'API utilise souvent les noms français).
- `overrides/characters.json` : corrections par personnage (nom, autres noms acceptés).
- `overrides/extra-characters.json` : personnages absents de l'API, ajoutés depuis leur page wiki.
- `overrides/api-fixes.json` : doublons de l'API à ignorer.
- `overrides/groups.json` : groupes du jeu « Trouve-les tous ».
- `overrides/arcs.json` : premier chapitre de chaque arc du manga, nature des arcs hors manga.
- `overrides/spoilers.json` : limite du mode anime, si l'API a du retard sur la diffusion.

## Spoilers

Le joueur choisit « à jour sur l'anime » ou « à jour sur le manga » au lancement d'un jeu. Les règles sont dans `src/lib/spoilers.ts` :

- chaque fait susceptible d'être révélé tard (prime, surnom, origine, affiliation, métier) porte `since`, le chapitre où il est établi ;
- le mode anime s'arrête à `meta.animeCutoffChapter`, le dernier chapitre adapté par l'anime ;
- un personnage n'est tiré dans un jeu que s'il appartient au manga et que sa première apparition est vérifiée (`isPlayableCharacter`).

Les jeux ne doivent jamais lire un personnage directement : ils passent par `isPlayableCharacter` puis `viewCharacter`.

## Images

Les portraits viennent de l'API publique d'[AniList](https://anilist.co/) (`scripts/images/fetch.ts`). Le One Piece Wiki protège ses images contre les téléchargements automatisés : on ne passe pas outre, ce qui explique l'absence de pavillons (jeu « Jolly Roger » en attente).

- Les fiches AniList sont rapprochées des personnages par leur nom ; `data/overrides/anilist-ids.json` force le rapprochement quand les graphies diffèrent.
- Les fichiers sont rangés dans `public/images/portraits/` sous un nom haché, et les jeux dessinent l'image dans un canevas : ni l'adresse ni la page ne donnent la réponse.
- `data/generated/images.json` tient l'inventaire (personnage → fichier, origine).

### Silhouettes

Le jeu « Silhouette » attend des portraits détourés. Le détourage automatique des portraits AniList a été essayé et écarté : sur ces cadrages serrés à décor peint, il produit des formes inexploitables. Pour en fournir à la main, déposer des PNG à fond transparent dans `assets/portraits/`, nommés d'après l'identifiant du personnage (`monkey-d-luffy.png`), puis lancer `npm run images:silhouettes`. Un portrait à fond opaque est refusé.
