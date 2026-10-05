import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { buildGameData, resolveGameData, type GameData, type ResolvedData } from "@/games/cards";
import { dailyKey } from "@/games/engine/daily";
import { createRng } from "@/games/engine/rng";
import { evaluateReport, reportKey, reportSchema } from "@/games/report";
import {
  applyGame,
  applyCrew,
  assignPost,
  buyBooster,
  buyCosmetic,
  buyRecruit,
  DAILY_BERRY_CAP,
  EMPTY_PLAYER,
  equipCosmetic,
  getCosmetic,
  grantCosmetic,
  POST_IDS,
  deleteCrew,
  sanitizeCosmetics,
  sanitizeSavedCrews,
  saveCrew,
  type CrewError,
  sellDuplicates,
  type PlayerState,
  type PostId,
} from "@/lib/economy";
import { isBuiltSlug } from "@/lib/games/catalog";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import type { BoosterResult, CosmeticResult, CrewResult, GameResult, RecruitResult, SellResult } from "@/lib/player/types";
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
export function gameData(mode: SpoilerMode, locale: Locale = DEFAULT_LOCALE): ResolvedData {
  const key = `${locale}:${mode}`;
  if (!resolved.has(key)) {
    if (!raw.has(locale)) raw.set(locale, buildGameData(locale));
    resolved.set(key, resolveGameData(raw.get(locale)!, mode));
  }
  return resolved.get(key)!;
}

/** Tirage imprévisible pour les récompenses : la graine vient du générateur du système. */
export const secureRng = () => createRng(randomInt(0, 0xffffffff));

export const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export type Tx = Prisma.TransactionClient;

const ratio = z.number().min(0).max(1);
const statsSchema = z.record(
  z.string(),
  z.object({
    games: z.number().int().nonnegative(),
    best: ratio,
    bestBy: z.object({ facile: ratio, normal: ratio, expert: ratio }).partial().optional(),
  }),
);
const challengeSchema = z.object({ progress: z.array(z.number()), done: z.array(z.boolean()) });
const weekSchema = challengeSchema.extend({ key: z.string() });

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
      dayChallenges: true,
      stats: true,
      week: true,
      cosmetics: true,
      equipped: true,
      savedCrews: true,
      collection: { select: { characterId: true, count: true, golden: true } },
      crew: { select: { post: true, characterId: true } },
    },
  });
  return {
    berrys: user.berrys,
    lifetimeBerrys: user.lifetimeBerrys,
    games: user.games,
    day: {
      key: user.dayKey,
      earned: user.dayEarned,
      done: z.array(z.string()).safeParse(user.dayDone).data ?? [],
      challenges: challengeSchema.safeParse(user.dayChallenges).data ?? EMPTY_PLAYER.day.challenges,
    },
    // Colonnes JSON : on ne se fie à leur contenu qu'après validation
    stats: statsSchema.safeParse(user.stats).data ?? {},
    week: weekSchema.safeParse(user.week).data ?? EMPTY_PLAYER.week,
    cosmetics: sanitizeCosmetics(user.cosmetics, user.equipped),
    savedCrews: sanitizeSavedCrews(user.savedCrews),
    collection: Object.fromEntries(user.collection.map((e) => [e.characterId, { count: e.count, golden: e.golden }])),
    crew: Object.fromEntries(
      user.crew.filter((slot) => (POST_IDS as readonly string[]).includes(slot.post)).map((slot) => [slot.post, slot.characterId]),
    ) as PlayerState["crew"],
  };
}

export async function addToCollection(tx: Tx, userId: string, characterId: string, golden: boolean) {
  await tx.collectionEntry.upsert({
    where: { userId_characterId: { userId, characterId } },
    create: { userId, characterId, count: 1, golden: golden ? 1 : 0 },
    update: { count: { increment: 1 }, golden: { increment: golden ? 1 : 0 } },
  });
}

/**
 * Verse des Berrys gagnés en jouant ailleurs que dans un mini-jeu (raid),
 * dans la limite du plafond du jour. Renvoie ce qui a réellement été versé.
 */
export async function creditPlay(tx: Tx, userId: string, wanted: number, today = dailyKey()): Promise<number> {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { dayKey: true, dayEarned: true } });
  const earnedToday = user.dayKey === today ? user.dayEarned : 0;
  const berrys = Math.max(0, Math.min(wanted, DAILY_BERRY_CAP - earnedToday));
  await tx.user.update({
    where: { id: userId },
    data: {
      berrys: { increment: berrys },
      lifetimeBerrys: { increment: berrys },
      dayKey: today,
      dayEarned: earnedToday + berrys,
      // Premier gain de la journée : les jeux du jour validés la veille et les défis quotidiens ne comptent plus
      ...(user.dayKey === today ? {} : { dayDone: [], dayChallenges: {} }),
    },
  });
  return berrys;
}

/** Donne à un joueur un cosmétique gagné (classé, raid). Renvoie `false` s'il l'avait déjà. */
export async function grantCosmeticTo(tx: Tx, userId: string, cosmeticId: string): Promise<boolean> {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { cosmetics: true, equipped: true } });
  const before = sanitizeCosmetics(user.cosmetics, user.equipped);
  const after = grantCosmetic(before, cosmeticId);
  if (after === before) return false;
  await tx.user.update({ where: { id: userId }, data: { cosmetics: after.owned } });
  return true;
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
          dayChallenges: applied.state.day.challenges,
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

/** Applique un changement d'équipage à un compte : les postes occupés et les équipages enregistrés sont réécrits ensemble. */
async function changeCrewFor(userId: string, change: (state: PlayerState) => PlayerState | CrewError): Promise<CrewResult> {
  return db().$transaction(async (tx) => {
    const next = change(await loadState(userId, tx));
    if (typeof next === "string") return { ok: false, reason: next };

    await tx.crewSlot.deleteMany({ where: { userId } });
    const slots = Object.entries(next.crew) as [PostId, string][];
    if (slots.length) {
      await tx.crewSlot.createMany({ data: slots.map(([p, id]) => ({ userId, post: p, characterId: id })) });
    }
    await tx.user.update({ where: { id: userId }, data: { savedCrews: next.savedCrews } });
    return { ok: true, state: await loadState(userId, tx) };
  });
}

export const setCrewFor = (userId: string, post: string, characterId: string | null) =>
  changeCrewFor(userId, (state) => assignPost(state, post, characterId));

/** Garde de côté l'équipage en place, sous ce nom (ou remplace celui qui le portait déjà). */
export const saveCrewFor = (userId: string, name: string) => changeCrewFor(userId, (state) => saveCrew(state, name, randomUUID()));

/** Remet en place un équipage enregistré. */
export const applyCrewFor = (userId: string, crewId: string) => changeCrewFor(userId, (state) => applyCrew(state, crewId));

export const deleteCrewFor = (userId: string, crewId: string) => changeCrewFor(userId, (state) => deleteCrew(state, crewId));

export async function buyCosmeticFor(userId: string, cosmeticId: string): Promise<CosmeticResult> {
  return db().$transaction(async (tx) => {
    const bought = buyCosmetic(await loadState(userId, tx), cosmeticId);
    if (typeof bought === "string") return { ok: false, reason: bought };

    // Le débit n'a lieu que si le solde le permet encore : deux achats simultanés ne passent pas tous les deux
    const paid = await tx.user.updateMany({
      where: { id: userId, berrys: { gte: bought.cost } },
      data: { berrys: { decrement: bought.cost }, cosmetics: bought.state.cosmetics.owned, equipped: bought.state.cosmetics.equipped },
    });
    if (paid.count === 0) return { ok: false, reason: "insufficient" };
    return { ok: true, state: await loadState(userId, tx) };
  });
}

export async function equipCosmeticFor(userId: string, slot: string, cosmeticId: string | null): Promise<CosmeticResult> {
  return db().$transaction(async (tx) => {
    const next = equipCosmetic(await loadState(userId, tx), slot, cosmeticId);
    if (typeof next === "string") return { ok: false, reason: next };
    await tx.user.update({ where: { id: userId }, data: { equipped: next.cosmetics.equipped } });
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
  cosmetics: z.object({ owned: z.array(z.string().max(80)).max(200), equipped: z.record(z.string(), z.string().max(80)) }).optional(),
  savedCrews: z.array(z.unknown()).max(50).optional(),
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

  // Seuls les cosmétiques de la boutique se reprennent : les autres se gagnent avec un compte
  const cosmetics = sanitizeCosmetics(
    (guest.cosmetics?.owned ?? []).filter((id) => getCosmetic(id)?.price != null),
    guest.cosmetics?.equipped,
  );

  const lifetimeBerrys = Math.min(guest.lifetimeBerrys, IMPORT_LIMITS.lifetimeBerrys);
  return {
    berrys: Math.min(guest.berrys, IMPORT_LIMITS.berrys, lifetimeBerrys),
    lifetimeBerrys,
    games: guest.games,
    // Le parcours par jeu est repris pour que les objectifs déjà atteints ne soient pas payés deux fois
    stats: Object.fromEntries(Object.entries(guest.stats ?? {}).filter(([slug]) => isBuiltSlug(slug))),
    collection,
    crew: crew.map(([post, characterId]) => ({ post, characterId })),
    // Un équipage enregistré peut citer un avis qui n'a pas été repris : il laissera son poste libre
    savedCrews: sanitizeSavedCrews(guest.savedCrews),
    cosmetics,
  };
}
