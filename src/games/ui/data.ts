"use client";

import type { GameData } from "../cards";

let pending: Promise<GameData> | undefined;

/** Les données sont communes à tous les jeux et aux pages du joueur : un seul téléchargement par visite. */
export function loadGameData(): Promise<GameData> {
  pending ??= fetch("/data/jeux.json").then((response) => {
    if (!response.ok) {
      pending = undefined;
      throw new Error(`Données des jeux indisponibles (${response.status})`);
    }
    return response.json() as Promise<GameData>;
  });
  return pending;
}
