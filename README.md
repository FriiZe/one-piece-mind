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
| `npm run images:silhouettes` | Génère les silhouettes à partir des portraits détourés |

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
- `overrides/characters.json` : corrections par personnage.
- `overrides/arcs.json` : premier chapitre de chaque arc du manga, nature des arcs hors manga.
- `overrides/spoilers.json` : limite du mode anime, si l'API a du retard sur la diffusion.

## Spoilers

Le joueur choisit « à jour sur l'anime » ou « à jour sur le manga » au lancement d'un jeu. Les règles sont dans `src/lib/spoilers.ts` :

- chaque fait susceptible d'être révélé tard (prime, surnom, origine, affiliation, métier) porte `since`, le chapitre où il est établi ;
- le mode anime s'arrête à `meta.animeCutoffChapter`, le dernier chapitre adapté par l'anime ;
- un personnage n'est tiré dans un jeu que s'il appartient au manga et que sa première apparition est vérifiée (`isPlayableCharacter`).

Les jeux ne doivent jamais lire un personnage directement : ils passent par `isPlayableCharacter` puis `viewCharacter`.

## Silhouettes

Déposer des portraits détourés (PNG à fond transparent) dans `assets/portraits/`, nommés d'après l'identifiant du personnage (`monkey-d-luffy.png`), puis lancer `npm run images:silhouettes`. Les silhouettes sont écrites dans `public/silhouettes/`. Un portrait à fond opaque est refusé.
