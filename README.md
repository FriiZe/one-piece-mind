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
├── content.ts     textes des pages de jeu (règles, questions fréquentes, métadonnées) : content.fr.ts et content.en.ts
├── ui/            éléments communs : lanceur, choix du mode spoiler, saisie assistée, quiz
├── engine/criteria.ts  propriétés vérifiables d'un personnage : Connexions, Grille 3×3, Den Den Devin
├── ui/SortableList.tsx liste à ranger par glisser-déposer : Le classement, Chronologie
├── qcm/           quiz à choix : douze jeux, un générateur de questions chacun
├── estimate/      estimation d'un nombre au curseur : trois jeux
├── clues/         personnage à retrouver par indices successifs : deux jeux
└── <jeu>/         logic.ts (fonctions pures, testées) et Game.tsx (affichage)
```

La plupart des jeux appartiennent à une famille qui partage son déroulé, son composant et la forme de son compte rendu. Ajouter un quiz à choix revient à écrire un générateur dans `src/games/qcm/logic.ts`.

Les jeux tournent dans le navigateur. Les données (`/data/jeux.json` en français, `/en/data/jeux.json` en anglais, générées à la compilation) sont téléchargées une fois, puis filtrées selon le mode du joueur par `resolveGameData` : un jeu ne reçoit jamais un personnage ou une information que le joueur n'a pas encore vus.

Pour ajouter un jeu :

1. écrire sa logique (un générateur dans une famille existante, ou `src/games/<slug>/logic.ts`) et ses tests ;
2. écrire `src/games/<slug>/Game.tsx` si aucune famille ne convient ;
3. ajouter le slug à `LIVE_SLUGS` (`src/lib/games/catalog.ts`) : TypeScript réclame alors son composant dans `GameRunner.tsx`, ses textes dans `content.fr.ts` et `content.en.ts` et son barème dans `src/lib/economy/rewards.ts` ;
4. déclarer la forme de son compte rendu et son recalcul dans `src/games/report.ts`.

Un jeu que le serveur ne peut pas vérifier (Den Den Devin, où c'est le joueur qui dit si l'escargophone a trouvé) figure dans `REWARDLESS_SLUGS` : il n'envoie pas de compte rendu, ne rapporte rien et n'a pas d'objectifs.

La page `/jeux/<slug>`, son image de partage et son entrée dans le plan du site sont créées automatiquement.

## Langues

Le site existe en français et en anglais. Le français est servi à la racine (`/jeux/wordle`), l'anglais sous `/en` (`/en/jeux/wordle`) : les segments d'adresse sont les mêmes dans les deux langues.

```
src/lib/i18n/index.ts    langues, `translator`, adresses (`localePath`, `splitLocale`), langue du navigateur
src/lib/i18n/client.tsx  `useT`, `useLocale`, `useLocalePath`, `usePath` pour les composants du navigateur
src/lib/i18n/server.ts   `getT`, `getLocale` pour les composants serveur
src/proxy.ts             routage : `/jeux` est rendu par `src/app/[lang]` avec `lang = fr`, `/fr/jeux` renvoie vers `/jeux`
src/components/Link.tsx  lien interne : l'adresse s'écrit sans langue, le préfixe est ajouté tout seul
```

- **Écrire un texte.** Les deux langues s'écrivent côte à côte, là où le texte sert : `const t = useT()` (ou `await getT()` côté serveur), puis `t("Jouer", "Play")`. Un texte gardé dans une table (catalogue, postes, objectifs) est un objet `{ fr, en }` (`Localized`), lu avec `[locale]`. Aucune bibliothèque, aucun fichier de clés.
- **Liens.** Toujours `Link` de `@/components/Link`, et `useLocalePath()` pour `router.push` : une adresse écrite en dur ramènerait le joueur en français.
- **Choix de la langue.** À sa première visite sur une adresse française, un navigateur réglé en anglais est renvoyé vers `/en`. Le sélecteur (en-tête et pied de page) enregistre le choix dans le cookie `opm_lang`, qui prime ensuite. Les moteurs de recherche, eux, reçoivent toujours la langue de l'adresse ; chaque page annonce ses deux versions (`hreflang`, plan du site).
- **Données des jeux.** `buildGameData(locale)` produit un jeu de données par langue : noms de personnages et de fruits, arcs, affiliations, groupes, surnoms. Les titres anglais des arcs et des groupes sont dans `data/overrides`, les surnoms et les types d'armes dans `data/curated`. L'organisation d'un personnage a deux formes : `org`, son nom sur le wiki, qui sert de clé (traits d'équipage) ; `affiliation`, son libellé dans la langue du joueur.
- **Logique des jeux.** Les textes que produit un jeu (questions, indices, corrections) suivent `data.locale`. Les libellés servant parfois de réponses, une partie n'est rejouée juste que dans sa langue : `submitGameAction` transmet la langue du joueur, et le serveur rejoue avec les données de cette langue. Le personnage du jour et les jeux du jour sont les mêmes dans les deux langues.
- **Multijoueur.** Un salon se joue dans la langue de son hôte (`Room.lang`) : tous ses joueurs voient les mêmes questions.
- **Quiz de la communauté.** Ils restent dans la langue de leur auteur ; seule l'interface est traduite.
- **Les tests de `tests/i18n.test.ts`** vérifient les adresses, les données anglaises, les jeux en anglais et, sur la base locale, la langue côté serveur.

## Économie et comptes

```
src/lib/economy/   règles pures : gains, recrutement, bonus d'équipage, prime du joueur
src/lib/player/    état du joueur côté navigateur, et actions envoyées au serveur
src/lib/server/    base de données, mots de passe, sessions, enregistrement des récompenses
prisma/            schéma et migrations
```

- **Jeux du jour.** Chaque jour (heure de Paris), cinq jeux sont tirés au hasard, les mêmes pour tous (`dailyGames` dans `daily.ts`). Avec le défi du jour, ce sont les seuls à rapporter des Berrys et des recrues : une fois chacun, à partir de la moitié des points. Les autres parties ne rapportent rien, mais comptent pour les objectifs et les défis de la semaine. Les jeux validés du jour sont gardés avec l'état du joueur (`day.done`). La création d'un compte offre 500 ฿.
- **Boutique.** Les Berrys s'y dépensent en avis de recherche : une recrue à l'unité (`buyRecruit`, 1 500 ฿) ou un booster de cinq avis (`buyBooster`, 6 000 ฿) dont chaque carte a ses propres chances (`BOOSTER_SLOTS`) : trois communes ou peu communes, une quatrième parfois rare, une dernière rare ou légendaire. Le tirage a lieu sur le serveur à l'achat ; l'ouverture animée (`src/components/PackOpening.tsx`) ne fait que dévoiler des avis déjà acquis.
- **Traits d'équipage.** Les membres d'une même affiliation placés à des postes activent le trait de cette affiliation, à 3, 5 puis 7 membres (`TRAITS` dans `crew.ts`) : Berrys, réduction à la boutique, chances de recruter ou d'avis doré selon l'affiliation. Les affiliations sans trait propre partagent un trait plus modeste. Plusieurs traits se cumulent.
- **Échanges.** Deux amis échangent un avis contre un avis (`src/lib/server/trades.ts`, page `/echanges`). Rien ne bouge avant l'acceptation ; les deux avis changent alors de collection dans une même transaction. Un joueur qui donne son seul exemplaire le perd, y compris dans son équipage. Dix propositions en attente et vingt par jour au plus.
- **Doublons.** Un avis obtenu plusieurs fois peut être défait contre des Berrys (`sellDuplicates`), selon sa rareté. On garde toujours un exemplaire, le doré s'il y en a un. Ces Berrys ne comptent ni dans la prime du joueur ni dans le plafond journalier.
- **Objectifs et défis.** Chaque jeu a six objectifs (régularité et réussite) ; six défis communs à tous les joueurs changent chaque lundi et quatre autres chaque jour (`objectives.ts`, `weekly.ts`, `dailies.ts`). La prime d'un objectif ou d'un défi de score suit la difficulté de la partie. Leurs primes s'ajoutent aux gains de la partie qui les fait atteindre, hors plafond journalier.
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
src/lib/server/push.ts    notifications push : abonnements des appareils, envoi
public/sw.js              service worker : affiche les notifications, ouvre la bonne page au clic
src/app/api/rooms/        routes interrogées par les navigateurs
src/components/multi/     page d'accueil du multijoueur et écran du salon
```

- **Pas de connexion permanente.** Chaque navigateur interroge `/api/rooms/<code>` toutes les une à deux secondes, avec le numéro de version qu'il connaît ; le serveur répond « rien de neuf » tant que le salon n'a pas changé. L'état du salon vit dans Postgres.
- **Pas de tâche de fond.** Le salon avance quand quelqu'un l'interroge : si le temps d'une question est écoulé, la requête qui le constate passe à la correction. Le numéro de version sert de verrou, deux requêtes simultanées ne font pas avancer le salon deux fois.
- **Le serveur fait foi.** Les questions sont tirées côté serveur à partir de la graine du salon ; la bonne réponse et les points de la question en cours ne partent qu'à la correction.
- **Joueurs sans compte.** À son arrivée, un joueur reçoit un ticket (identifiant et jeton) gardé dans son navigateur ; il le renvoie à chaque appel. Recharger la page ne fait pas quitter le salon.
- **Berrys.** Payés une seule fois par partie aux joueurs connectés, selon le score et la place, dans la limite du plafond journalier.
- **Notifications.** La cloche de l'en-tête compte les demandes d'ami reçues, les invitations dans un salon et, pour un administrateur, les quiz masqués à relire (`/api/notifications`). Elle est relue toutes les quarante-cinq secondes tant que l'onglet est visible ; le détail n'est chargé qu'à l'ouverture.
- **Notifications push.** Depuis la cloche, un joueur connecté peut être prévenu sur son appareil, site fermé : demande d'ami reçue ou acceptée, invitation dans un salon, échange proposé, accepté ou refusé, annonce du marché vendue, adversaire du raid vaincu et, pour un administrateur, quiz masqué (`PushEvent` dans `src/lib/multi/push.ts`). Le message part dans la langue du site sur cet appareil. L'abonnement d'un navigateur (`PushSubscription`) est rattaché à sa session : se déconnecter, ou laisser la session expirer, arrête les notifications. Un abonnement résilié par le navigateur est oublié au premier envoi refusé. L'envoi se fait pendant l'action qui le déclenche, sans jamais la faire échouer, et le serveur n'écrit qu'aux services de notification connus (Chrome, Firefox, Safari, Edge). Sur iPhone et iPad, il faut d'abord ajouter le site à l'écran d'accueil (`src/app/manifest.ts`). Sans clés VAPID, rien n'est proposé.
- **Les tests de `tests/push.test.ts`** couvrent les messages, le contrôle des abonnements et, sur la base locale, qui est prévenu de quoi ; aucun message ne part vraiment.
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
- **Administrateurs** : `ADMIN_USERNAMES` (pseudos séparés par des virgules) est à définir dans les variables d'environnement de production pour modérer les quiz de la communauté et ouvrir l'administration (`/admin`).
- **Notifications push** : `NEXT_PUBLIC_VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY`, une paire tirée avec `npx web-push generate-vapid-keys`, à définir avant le build (la clé publique est inscrite dans le code du navigateur). Sans elles, le site fonctionne sans notifications push. En changer désabonne tous les appareils.
- **Adresse du site** : déduite du domaine de production ; `NEXT_PUBLIC_SITE_URL` ne sert qu'à en imposer une autre (domaine personnalisé).

Les préversions et le poste de développement ne sont pas reliés à la base de production : les préversions tournent en mode invité, le développement sur la base Docker locale.

## Classé, raid, marché et cosmétiques

```
src/lib/ranked/              règles du classé (cote, ligues, saisons, file d'attente), types, lecture depuis le navigateur
src/lib/server/ranked.ts     file d'attente, ouverture des duels, mise à jour des cotes, classement de la saison
src/lib/raid/                règles du raid (adversaires, dégâts, butin), types, lecture depuis le navigateur
src/lib/server/raid.ts       raid de la semaine, assauts, butin
src/lib/market/              règles du marché (prix, taxe, exemplaires vendables), types, lecture depuis le navigateur
src/lib/server/market.ts     annonces, achat, retrait
src/lib/economy/cosmetics.ts catalogue des cosmétiques, achat, port
src/components/Cosmetics.tsx dessin des pavillons, des navires et des cadres
```

Les quatre suivent les principes des salons : pas de connexion permanente, pas de tâche de fond, le serveur fait foi. Tout ce qui est périodique (saison, raid de la semaine) est soldé par la première requête qui constate que la période a changé.

- **Classé** (`/classe`). Un duel à un contre un, réservé aux comptes. Le joueur entre dans la file (`RankedQueue`) et donne signe de vie toutes les deux secondes ; chaque signe de vie cherche un adversaire de la même langue, le plus proche de sa cote, dans un écart qui s'élargit avec l'attente (`ratingWindow`). Deux joueurs réunis sont réservés dans une même transaction, toujours dans le même ordre, pour que deux recherches simultanées n'ouvrent pas deux duels.
- **Le duel est un salon.** `openDuel` crée un salon `kind = "ranked"` déjà lancé, sur un compte à rebours (`phase = "countdown"`), avec des réglages fixes : dix questions de dix secondes, mode anime pour que personne ne soit spoilé. Le déroulé, les points et les Berrys sont ceux d'un salon. Un duel ne se relance pas : la revanche repasse par la file.
- **Cote.** À la fin, la première requête qui voit le salon terminé met à jour les deux cotes (`settleDuel`, formule Elo, `Room.settledAt` sert de verrou) et garde le duel (`RankedMatch`). Un duel que les deux joueurs ont quitté est soldé sur les points marqués quand l'un d'eux revient dans la file (`finishStaleDuels`) : partir n'évite pas une défaite. Deux mêmes joueurs ne sont plus réunis après cinq duels dans la journée.
- **Ligues et saisons.** Cinq ligues selon la cote (`LEAGUES`), une saison par mois (heure de Paris). À son retour après un changement de mois, le joueur touche la prime de sa ligue s'il a joué cinq duels, les deux ligues les plus hautes y ajoutent un titre, et sa cote revient à mi-chemin de la cote de départ (`rollSeason`, `ensureSeason`). Les cinq rangs Mousse à Empereur restent ceux de la prime du joueur : les ligues ont leurs propres noms.
- **Raid** (`/raid`). Chaque semaine, du lundi au dimanche, tous les joueurs affrontent le même adversaire, un Empereur ou un Amiral (`RAID_BOSSES`, à tour de rôle). Ses points de vie sont fixés à l'ouverture du raid d'après le nombre de joueurs venus dans la semaine (`raidHp`).
- **Assauts.** Trois par jour, de dix questions. Le serveur tire les questions et n'envoie que les énoncés : la graine reste en base, les réponses ne partent qu'à la fin, et un assaut rendu après le délai ne compte pas. Chaque bonne réponse inflige 100 dégâts, augmentés par les postes pourvus de l'équipage (`raidCrewBonus`) et par un sans-faute. Chaque assaut rapporte des Berrys, dans le plafond journalier. Limite assumée : le chrono par question n'est tenu que par le navigateur ; le serveur ne contrôle que la durée totale.
- **Butin.** Si l'adversaire tombe, chaque joueur qui lui a infligé au moins 500 dégâts récupère 3 000 ฿ et son avis de recherche, doré pour les trois premiers, qui reçoivent aussi un titre. Le butin se réclame sur la page du raid, y compris les semaines suivantes.
- **Marché** (`/marche`). Un joueur met en vente un exemplaire en trop, ordinaire ou doré, à un prix borné selon la rareté (`priceBounds` : du prix du doublon défait à vingt fois ce prix). L'exemplaire quitte sa collection tant que l'annonce est ouverte ; il garde toujours un exemplaire de chaque avis. À l'achat, l'annonce se ferme, l'acheteur paie, le vendeur touche le prix moins 10 % de taxe et l'avis change de collection, dans une même transaction. Ces Berrys ne comptent ni dans la prime du vendeur ni dans son plafond du jour. Dix annonces ouvertes par joueur.
- **Spoilers au marché.** Les annonces sont filtrées côté serveur selon le mode du joueur : un personnage que l'anime n'a pas encore montré n'apparaît qu'en mode manga.
- **Cosmétiques.** Cadre de l'avis de recherche, pavillon, navire et titre (`COSMETICS`). Ils s'achètent à la boutique à prix fixe, sans réduction d'équipage, et se portent aussitôt ; trois titres ne s'achètent pas et se gagnent en classé ou en raid. Ils font partie de l'état du joueur (`PlayerState.cosmetics`) : un invité peut en acheter, et ceux de la boutique sont repris à la création du compte. Les autres joueurs les voient dans les classements.
- **Notifications.** La cloche compte aussi les avis vendus au marché que le vendeur n'a pas encore vus, et les butins de raid à récupérer. Une vente prévient en plus le vendeur par notification push, avec l'acheteur, l'avis et ce qu'il touche (`market-sold`). Quand l'adversaire du raid tombe, les joueurs qui ont droit au butin sont prévenus de la même façon (`raid-defeated`), sauf celui qui a porté le dernier coup, qui le voit à l'écran. Le classé n'envoie pas de notification push.
- **Les tests de `tests/phase5.test.ts`** couvrent les règles et, sur la base locale, un duel complet, un raid jusqu'au butin, le parcours d'une annonce et l'achat d'un cosmétique.

## Administration

```
src/lib/server/admin.ts    chiffres du tableau de bord, liste des joueurs, fiche d'un joueur
src/lib/admin/format.ts    dates, graduations, titres des jeux
src/components/admin/      graphique par jour, tuiles, en-tête
src/app/[lang]/admin/      /admin, /admin/joueurs, /admin/joueurs/[id]
```

- **Accès.** Réservé aux pseudos de `ADMIN_USERNAMES`. Pour tout autre visiteur, connecté ou non, ces pages répondent 404 : chaque fonction de `admin.ts` vérifie elle-même le demandeur et ne renvoie rien sinon. Un administrateur trouve le lien sur son profil.
- **Vue d'ensemble** (`/admin`). Comptes, inscriptions et parties du jour, joueurs vus sur 24 heures et 7 jours ; puis, sur 7, 30 ou 90 jours (`?jours=`), les inscriptions, les joueurs actifs et les parties jour par jour, les jeux les plus joués et les dernières inscriptions. Les jours changent à minuit, heure de Paris.
- **Joueurs** (`/admin/joueurs`). Recherche par pseudo, tri par inscription, dernière visite, parties, prime ou Berrys, par pages de 50. La fiche d'un joueur donne son parcours : dernières parties, résultats par jeu, collection, sessions ouvertes, quiz écrits.
- **Dernière visite.** `User.lastSeenAt` est mis à jour à la lecture de la session, au plus une fois toutes les dix minutes par joueur. Un compte qui n'est pas revenu depuis l'ajout de la colonne n'a pas de dernière visite.
- **Limite.** Seuls les comptes sont suivis : un invité joue dans son navigateur sans rien envoyer au serveur. Une « partie » est une partie récompensée (`GameResult`).
- **Les tests de `tests/admin.test.ts`** couvrent, sur la base locale, le refus des non-administrateurs, les décomptes par jour, la recherche et la fiche.

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
