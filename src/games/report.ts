/**
 * Compte rendu de partie : ce que le navigateur envoie en fin de jeu (la
 * graine du tirage et les réponses données, jamais un score). `evaluateReport`
 * rejoue la partie et en déduit le résultat ; le serveur ne fait confiance
 * qu'à ce recalcul.
 */
import { z } from "zod";
import { getGame } from "@/lib/games/catalog";
import type { GameOutcome } from "@/lib/economy/types";
import type { ResolvedData } from "./cards";
import * as avis from "./avis-de-recherche/logic";
import * as classement from "./le-classement/logic";
import * as onepiecedle from "./onepiecedle/logic";
import * as plusOuMoins from "./plus-ou-moins/logic";
import * as quiAMange from "./qui-a-mange-ce-fruit/logic";
import * as reveal from "./revelation/logic";
import * as trouve from "./trouve-les-tous/logic";
import * as typeDeFruit from "./type-de-fruit/logic";

const seed = z.number().int().nonnegative().max(0xffffffff);
const mode = z.enum(["anime", "manga"]);
const difficulty = z.enum(["facile", "normal", "expert"]);
const id = z.string().min(1).max(80);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const posterEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("guess"), id }),
  z.object({ type: z.literal("hint") }),
  z.object({ type: z.literal("pass") }),
]);
const revealEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("guess"), id, step: z.number().int().min(0).max(reveal.STEPS - 1) }),
  z.object({ type: z.literal("pass") }),
]);
const revealRounds = z.array(z.array(revealEvent).max(reveal.STEPS + 1)).max(reveal.ROUNDS);

export const reportSchema = z.discriminatedUnion("slug", [
  z.object({ slug: z.literal("type-de-fruit"), seed, mode, answers: z.array(z.string().max(20)).max(typeDeFruit.QUIZ_LENGTH) }),
  z.object({ slug: z.literal("qui-a-mange-ce-fruit"), seed, mode, difficulty, answers: z.array(id).max(10) }),
  z.object({
    slug: z.literal("le-classement"),
    seed,
    mode,
    difficulty,
    orders: z.array(z.array(id).max(classement.ROUND_SIZE)).max(classement.ROUNDS),
  }),
  z.object({ slug: z.literal("plus-ou-moins"), seed, mode, difficulty, answers: z.array(z.enum(["higher", "lower"])).max(500) }),
  z.object({
    slug: z.literal("avis-de-recherche"),
    seed,
    mode,
    difficulty,
    posters: z.array(z.array(posterEvent).max(12)).max(avis.POSTERS),
  }),
  z.object({ slug: z.literal("trouve-les-tous"), seed, mode, groupId: id, found: z.array(id).max(40) }),
  z.object({ slug: z.literal("onepiecedle"), seed, mode, difficulty, guesses: z.array(id).max(200) }),
  z.object({ slug: z.literal("onepiecedle-daily"), day, mode, guesses: z.array(id).max(200) }),
  z.object({ slug: z.literal("revelation"), seed, mode, difficulty, rounds: revealRounds }),
  z.object({ slug: z.literal("zoom-extreme"), seed, mode, difficulty, rounds: revealRounds }),
]);
export type GameReport = z.infer<typeof reportSchema>;

/** Identifie une partie pour un joueur : la même ne peut être récompensée deux fois. */
export function reportKey(report: GameReport): string {
  return report.slug === "onepiecedle-daily" ? `daily:${report.day}` : String(report.seed);
}

export type EvaluationContext = {
  /** Données dans le mode du joueur. */
  data: ResolvedData;
  /** Personnages du mode anime : le défi du jour est tiré parmi eux pour tout le monde. */
  animeCharacters: ResolvedData["characters"];
  /** Date du jour à Paris : un défi du jour ne se joue que le jour même. */
  today: string;
};

/** Rejoue la partie décrite par le compte rendu. `null` si elle ne peut pas avoir eu lieu. */
export function evaluateReport(report: GameReport, { data, animeCharacters, today }: EvaluationContext): GameOutcome | null {
  const slug = report.slug === "onepiecedle-daily" ? "onepiecedle" : report.slug;
  const category = getGame(slug)!.category;
  const outcome = (result: { score: number; max: number }, daily = false): GameOutcome => ({
    slug,
    category,
    score: result.score,
    max: result.max,
    performance: result.max > 0 ? Math.min(1, result.score / result.max) : 0,
    difficulty: "difficulty" in report ? report.difficulty : null,
    daily,
  });

  switch (report.slug) {
    case "type-de-fruit":
      return outcome(typeDeFruit.evaluate(report.seed, report.answers, data.fruits));
    case "qui-a-mange-ce-fruit":
      return outcome(quiAMange.evaluate(report.seed, report.difficulty, report.answers, data));
    case "le-classement":
      return outcome(classement.evaluate(report.seed, report.difficulty, report.orders, data.characters));
    case "plus-ou-moins":
      return outcome(plusOuMoins.evaluate(report.seed, report.difficulty, report.answers, data.characters));
    case "avis-de-recherche":
      return outcome(avis.evaluate(report.seed, report.difficulty, report.posters, data));
    case "trouve-les-tous": {
      const group = data.groups.find((g) => g.id === report.groupId);
      return group ? outcome(trouve.evaluate(group, report.found)) : null;
    }
    case "onepiecedle":
      return outcome(
        onepiecedle.evaluate(onepiecedle.freeTarget(report.seed, report.difficulty, data.characters), report.guesses),
      );
    case "onepiecedle-daily":
      if (report.day !== today) return null;
      return outcome(onepiecedle.evaluate(onepiecedle.dailyTarget(animeCharacters, report.day), report.guesses), true);
    case "revelation":
    case "zoom-extreme":
      return outcome(reveal.evaluate(report.seed, report.difficulty, report.rounds, data.characters));
  }
}
