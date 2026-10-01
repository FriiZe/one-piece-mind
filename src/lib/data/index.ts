/**
 * Accès au jeu de données généré (data/generated, produit par `npm run data:build`).
 * À n'importer que côté serveur : characters.json pèse près d'un mégaoctet.
 */
import arcsJson from "@data/generated/arcs.json";
import charactersJson from "@data/generated/characters.json";
import crewsJson from "@data/generated/crews.json";
import fruitsJson from "@data/generated/fruits.json";
import islandsJson from "@data/generated/islands.json";
import metaJson from "@data/generated/meta.json";
import sagasJson from "@data/generated/sagas.json";
import shipsJson from "@data/generated/ships.json";
import swordsJson from "@data/generated/swords.json";
import type { Arc, Character, Crew, DatasetMeta, Fruit, Island, Saga, Ship, Sword } from "./schema";

// Les fichiers sont validés par leur schéma à la génération et par les tests.
export const characters = charactersJson as unknown as Character[];
export const fruits = fruitsJson as unknown as Fruit[];
export const crews = crewsJson as unknown as Crew[];
export const sagas = sagasJson as unknown as Saga[];
export const arcs = arcsJson as unknown as Arc[];
export const islands = islandsJson as unknown as Island[];
export const ships = shipsJson as unknown as Ship[];
export const swords = swordsJson as unknown as Sword[];
export const meta = metaJson as unknown as DatasetMeta;

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export const characterById = indexById(characters);
export const fruitById = indexById(fruits);
export const crewById = indexById(crews);
export const arcById = indexById(arcs);

/** Arc du manga qui contient le chapitre donné. */
export function arcOfChapter(chapter: number): Arc | undefined {
  return arcs.find((arc) => arc.chapters && chapter >= arc.chapters.first && chapter <= arc.chapters.last);
}
