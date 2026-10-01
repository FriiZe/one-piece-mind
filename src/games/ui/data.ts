"use client";

import type { GameData } from "../cards";
import { localePath, type Locale } from "@/lib/i18n";

const pending = new Map<Locale, Promise<GameData>>();

/** Les données sont communes à tous les jeux et aux pages du joueur : un seul téléchargement par visite et par langue. */
export function loadGameData(locale: Locale): Promise<GameData> {
  let request = pending.get(locale);
  if (!request) {
    request = fetch(localePath(locale, "/data/jeux.json")).then((response) => {
      if (!response.ok) {
        pending.delete(locale);
        throw new Error(`Données des jeux indisponibles (${response.status})`);
      }
      return response.json() as Promise<GameData>;
    });
    pending.set(locale, request);
  }
  return request;
}
