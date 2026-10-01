# OnePieceMind

Site de mini-jeux One Piece (nom provisoire). Le plan complet du projet est dans [PLAN.md](PLAN.md).

## Démarrer

```bash
npm install
npm run dev
```

Le site tourne sur http://localhost:3000. Le jeu de données généré (`data/generated/`) est versionné : aucune étape d'import n'est nécessaire pour lancer le site.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` / `test` | Qualité : ESLint, TypeScript, Vitest |
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
└── <jeu>/         logic.ts (fonctions pures, testées) et Game.tsx (affichage)
```

Les jeux tournent dans le navigateur. Les données (`/data/jeux.json`, générées à la compilation) sont téléchargées une fois, puis filtrées selon le mode du joueur par `resolveGameData` : un jeu ne reçoit jamais un personnage ou une information que le joueur n'a pas encore vus.

Pour ajouter un jeu :

1. écrire `src/games/<slug>/logic.ts` et ses tests dans `tests/games.test.ts` ;
2. écrire `src/games/<slug>/Game.tsx`, qui reçoit `GameProps` ;
3. ajouter le slug à `LIVE_SLUGS` (`src/lib/games/catalog.ts`) : TypeScript réclame alors son composant dans `GameRunner.tsx` et ses textes dans `content.ts`.

La page `/jeux/<slug>`, son image de partage et son entrée dans le plan du site sont créées automatiquement.

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
