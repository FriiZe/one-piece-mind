import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { buildGameData, resolveGameData, type GameData, type ResolvedData } from "@/games/cards";
import { dailyKey } from "@/games/engine/daily";
import { createRng } from "@/games/engine/rng";
import { evaluateReport, reportKey, reportSchema } from "@/games/report";
import {
  applyGame,
  assignPost,
  buyBooster,
  buyRecruit,
  EMPTY_PLAYER,
  POST_IDS,
  sellDuplicates,
  type PlayerState,
  type PostId,
} from "@/lib/economy";
import { isLiveSlug } from "@/lib/games/catalog";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import type { BoosterResult, CrewResult, GameResult, RecruitResult, SellResult } from "@/lib/player/types";
import type { SpoilerMode } from "@/lib/spoilers";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";

const raw = new Map<Locale, GameData>();
const resolved = new Map<string, ResolvedData>();

/**
 * Données des jeux dans un mode et une langue donnés, calculées une fois par
 * instance du serveur. La langue ne compte que pour rejouer une partie (les
 * libellés servent de réponses) : collection et équipage n'en dépendent pas.
 */
function gameData(mode: SpoilerMode, locale: Locale = DEFAULT_LOCALE): ResolvedData {
  const key = `${locale}:${mode}`;
  if (!resolved.has(key)) {
    if (!raw.has(locale)) raw.set(locale, buildGameData(locale));
    resolved.set(key, resolveGameData(raw.get(locale)!, mode));
  }
  return resolved.get(key)!;
}

/** Tirage imprévisible pour les récompenses : la graine vient du générateur du système. */
const secureRng = () => createRng(randomInt(0, 0xffffffff));

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

type Tx = Prisma.TransactionClient;

const statsSchema = z.record(z.string(), z.object({ games: z.number().int().nonnegative(), best: z.number().min(0).max(1) }));
const weekSchema = z.object({ key: z.string(), progress: z.array(z.number()), done: z.array(z.boolean()) });

export async function loadState(userId: string, client: Tx = db()): Promise<PlayerState> {
  const user = await client.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      berrys: true,
      lifetimeBerrys: true,
      games: true,
      dayKey: true,
      dayEarned: true,
      dayDone: true,
      stats: true,
      week: true,
      collection: { select: { characterId: true, count: true, golden: true } },
      crew: { select: { post: true, characterId: true } },
    },
  });
  return {
    berrys: user.berrys,
    lifetimeBerrys: user.lifetimeBerrys,
    games: user.games,
    day: { key: user.dayKey, earned: user.dayEarned, done: z.array(z.string()).safeParse(user.dayDone).data ?? [] },
    // Colonnes JSON : on ne se fie à leur contenu qu'après validation
    stats: statsSchema.safeParse(user.stats).data ?? {},
    week: weekSchema.safeParse(user.week).data ?? EMPTY_PLAYER.week,
    collection: Object.fromEntries(user.collection.map((e) => [e.characterId, { count: e.count, golden: e.golden }])),
    crew: Object.fromEntries(
      user.crew.filter((slot) => (POST_IDS as readonly string[]).includes(slot.post)).map((slot) => [slot.post, slot.characterId]),
    ) as PlayerState["crew"],
  };
}

async function addToCollection(tx: Tx, userId: string, characterId: string, golden: boolean) {
  await tx.collectionEntry.upsert({
    where: { userId_characterId: { userId, characterId } },
    create: { userId, characterId, count: 1, golden: golden ? 1 : 0 },
    update: { count: { increment: 1 }, golden: { increment: golden ? 1 : 0 } },
  });
}

/** Parties récompensées par minute au-delà desquelles on refuse : aucun joueur ne va aussi vite. */
const MAX_GAMES_PER_MINUTE = 20;

/**
 * Récompense une partie. Le compte rendu vient du navigateur : il est validé,
 * la partie est rejouée ici, et seul ce recalcul fixe les gains. `locale` : la
 * langue dans laquelle la partie a été jouée, pour retrouver les mêmes tirages.
 */
export async function submitGame(userId: string, input: unknown, today = dailyKey(), locale: Locale = DEFAULT_LOCALE): Promise<GameResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const report = parsed.data;

  const data = gameData(report.mode, locale);
  const outcome = evaluateReport(report, { data, animeCharacters: gameData("anime", locale).characters, today });
  if (!outcome) return { ok: false, reason: "invalid" };

  const recent = await db().gameResult.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 60_000) } } });
  if (recent >= MAX_GAMES_PER_MINUTE) return { ok: false, reason: "limit" };

  try {
    return await db().$transaction(async (tx) => {
      const applied = applyGame(await loadState(userId, tx), outcome, data.characters, today, secureRng());
      const { reward } = applied;

      // L'unicité (joueur, jeu, tirage) fait échouer la transaction si la partie a déjà été payée
      await tx.gameResult.create({
        data: {
          userId,
          slug: report.slug,
          reportKey: reportKey(report),
          mode: report.mode,
          difficulty: outcome.difficulty,
          score: outcome.score,
          maxScore: outcome.max,
          berrys: reward.total,
          recruitId: reward.recruit?.characterId ?? null,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          berrys: { increment: reward.total },
          lifetimeBerrys: { increment: reward.total },
          games: { increment: 1 },
          dayKey: applied.state.day.key,
          dayEarned: applied.state.day.earned,
          dayDone: applied.state.day.done,
          stats: applied.state.stats,
          week: applied.state.week,
        },
      });
      if (reward.recruit) await addToCollection(tx, userId, reward.recruit.characterId, reward.recruit.golden);

      return { ok: true, state: await loadState(userId, tx), outcome, reward } satisfies GameResult;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
    throw error;
  }
}

export async function buyRecruitFor(userId: string, mode: SpoilerMode): Promise<RecruitResult> {
  const data = gameData(mode);
  return db().$transaction(async (tx) => {
    const bought = buyRecruit(await loadState(userId, tx), data.characters, secureRng());
    if (typeof bought === "string") return { ok: false, reason: bought };

    // Le débit n'a lieu que si le solde le permet encore : deux achats simultanés ne passent pas tous les deux
    const paid = await tx.user.updateMany({
      where: { id: userId, berrys: { gte: bought.cost } },
      data: { berrys: { decrement: bought.cost } },
    });
    if (paid.count === 0) return { ok: false, reason: "insufficient" };

    await addToCollection(tx, userId, bought.recruit.characterId, bought.recruit.golden);
    return { ok: true, state: await loadState(userId, tx), recruit: bought.recruit, cost: bought.cost };
  });
}

export async function buyBoosterFor(userId: string, mode: SpoilerMode): Promise<BoosterResult> {
  const data = gameData(mode);
  return db().$transaction(async (tx) => {
    const bought = buyBooster(await loadState(userId, tx), data.characters, secureRng());
    if (typeof bought === "string") return { ok: false, reason: bought };

    // Le débit n'a lieu que si le solde le permet encore : deux achats simultanés ne passent pas tous les deux
    const paid = await tx.user.updateMany({
      where: { id: userId, berrys: { gte: bought.cost } },
      data: { berrys: { decrement: bought.cost } },
    });
    if (paid.count === 0) return { ok: false, reason: "insufficient" };

    for (const recruit of bought.recruits) await addToCollection(tx, userId, recruit.characterId, recruit.golden);
    return { ok: true, state: await loadState(userId, tx), recruits: bought.recruits, cost: bought.cost };
  });
}

class ConcurrentChange extends Error {}

/** Défait les doublons d'un avis, ou de tous ceux que le joueur voit dans son mode (`characterId` nul). */
export async function sellDuplicatesFor(userId: string, mode: SpoilerMode, characterId: string | null): Promise<SellResult> {
  const data = gameData(mode);
  try {
    return await db().$transaction(async (tx) => {
      const before = await loadState(userId, tx);
      const sale = sellDuplicates(before, data.characterById, characterId);
      if (typeof sale === "string") return { ok: false, reason: sale };

      for (const id of sale.changed) {
        // L'avis doit être resté tel qu'on l'a lu : deux ventes simultanées ne sont pas payées deux fois
        const updated = await tx.collectionEntry.updateMany({
          where: { userId, characterId: id, count: before.collection[id].count, golden: before.collection[id].golden },
          data: sale.state.collection[id],
        });
        if (updated.count === 0) throw new ConcurrentChange();
      }
      await tx.user.update({ where: { id: userId }, data: { berrys: { increment: sale.berrys } } });
      return { ok: true, state: await loadState(userId, tx), berrys: sale.berrys, sold: sale.sold };
    });
  } catch (error) {
    if (error instanceof ConcurrentChange) return { ok: false, reason: "unavailable" };
    throw error;
  }
}

export async function setCrewFor(userId: string, post: string, characterId: string | null): Promise<CrewResult> {
  return db().$transaction(async (tx) => {
    const next = assignPost(await loadState(userId, tx), post, characterId);
    if (typeof next === "string") return { ok: false, reason: next };

    await tx.crewSlot.deleteMany({ where: { userId } });
    const slots = Object.entries(next.crew) as [PostId, string][];
    if (slots.length) {
      await tx.crewSlot.createMany({ data: slots.map(([p, id]) => ({ userId, post: p, characterId: id })) });
    }
    return { ok: true, state: await loadState(userId, tx) };
  });
}

// ---------------------------------------------------------------------------
// Reprise de la progression d'un invité à la création du compte

/** Plafonds de la reprise : l'état d'un invité vit dans son navigateur, donc sans garantie. */
const IMPORT_LIMITS = { berrys: 100_000, lifetimeBerrys: 500_000, perCharacter: 50 };

const guestStateSchema = z.object({
  berrys: z.number().int().nonnegative(),
  lifetimeBerrys: z.number().int().nonnegative(),
  games: z.number().int().nonnegative().max(100_000),
  collection: z.record(
    z.string().max(80),
    z.object({ count: z.number().int().positive(), golden: z.number().int().nonnegative() }),
  ),
  crew: z.record(z.string(), z.string().max(80)),
  stats: statsSchema.optional(),
});

/** Ce qu'on accepte de reprendre d'un état d'invité : valeurs plafonnées, personnages connus seulement. */
export function sanitizeGuestState(input: unknown) {
  const parsed = guestStateSchema.safeParse(input);
  if (!parsed.success) return null;
  const guest = parsed.data;
  const known = gameData("manga").characterById;

  const collection = Object.entries(guest.collection)
    .filter(([id]) => known.has(id))
    .map(([characterId, entry]) => {
      const count = Math.min(entry.count, IMPORT_LIMITS.perCharacter);
      return { characterId, count, golden: Math.min(entry.golden, count) };
    });
  const owned = new Set(collection.map((entry) => entry.characterId));
  const seen = new Set<string>();
  const crew = Object.entries(guest.crew).filter(([post, id]) => {
    if (!(POST_IDS as readonly string[]).includes(post) || !owned.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const lifetimeBerrys = Math.min(guest.lifetimeBerrys, IMPORT_LIMITS.lifetimeBerrys);
  return {
    berrys: Math.min(guest.berrys, IMPORT_LIMITS.berrys, lifetimeBerrys),
    lifetimeBerrys,
    games: guest.games,
    // Le parcours par jeu est repris pour que les objectifs déjà atteints ne soient pas payés deux fois
    stats: Object.fromEntries(Object.entries(guest.stats ?? {}).filter(([slug]) => isLiveSlug(slug))),
    collection,
    crew: crew.map(([post, characterId]) => ({ post, characterId })),
  };
}
