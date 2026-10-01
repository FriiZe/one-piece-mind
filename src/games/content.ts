/**
 * Textes des pages de jeu : ce qui est lu par les moteurs de recherche et par
 * un joueur qui découvre le jeu. Un jeu n'est en ligne que s'il figure ici,
 * dans chaque langue : content.fr.ts et content.en.ts.
 */
import type { LiveSlug } from "@/lib/games/catalog";
import type { Localized } from "@/lib/i18n";
import { GAME_CONTENT_EN } from "./content.en";
import { GAME_CONTENT_FR } from "./content.fr";

export type GameContent = {
  /** Titre de l'onglet et des résultats de recherche. */
  metaTitle: string;
  metaDescription: string;
  intro: string;
  howTo: string[];
  faq: { question: string; answer: string }[];
};

export const GAME_CONTENT: Localized<Record<LiveSlug, GameContent>> = { fr: GAME_CONTENT_FR, en: GAME_CONTENT_EN };
