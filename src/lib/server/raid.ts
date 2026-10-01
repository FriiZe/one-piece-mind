import "server-only";
import { randomInt } from "node:crypto";
import { dailyKey } from "@/games/engine/daily";
import { generateMixed, MIX_SLUGS } from "@/games/qcm/logic";
import { daysLeftInWeek, sanitizeCosmetics, weekKey } from "@/lib/economy";
import type { Locale } from "@/lib/i18n";
import {
  RAID_ATTACK_MS,
  RAID_ATTACKS_PER_DAY,
  RAID_BOSSES,
  RAID_LOOT,
  RAID_QUESTIONS,
  raidAttackBerrys,
  raidBoss,
  raidCrewBonus,
  raidDamage,
  raidHp,
} from "@/lib/raid/rules";
import type { RaidAttackResult, RaidClaimResult, RaidLootView, RaidStartResult, RaidView } from "@/lib/raid/types";
import type { SpoilerMode } from "@/lib/spoilers";
import { db } from "./db";
import { addToCollection, creditPlay, gameData, grantCosmeticTo, isUniqueViolation, loadState } from "./player";
import { notify, pushEnabled } from "./push";

const LEADERBOARD_SIZE = 20;
const WEEK_MS = 7 * 86_400_000;

type RaidRow = { week: string; bossId: string; hp: number; damage: number; defeatedAt: Date | null };

/**
 * Raid de la semaine, ouvert par la première requête qui le demande : aucune
 * tâche ne tourne le lundi. Ses points de vie sont fixés à ce moment-là,
 * d'après le nombre de joueurs venus dans les sept derniers jours.
 */
async function ensureRaid(week: string): Promise<RaidRow> {
  const existing = await db().raid.findUnique({ where: { week } });
  if (existing) return existing;
  const active = await db().user.count({ where: { lastSeenAt: { gte: new Date(Date.now() - WEEK_MS) } } });
  try {
    return await db().raid.create({ data: { week, bossId: raidBoss(week).id, hp: raidHp(active) } });
  } catch (error) {
    // Une autre requête vient de l'ouvrir
    if (!isUniqueViolation(error)) throw error;
    return db().raid.findUniqueOrThrow({ where: { week } });
  }
}

const bossOf = (raid: RaidRow) => RAID_BOSSES.find((boss) => boss.id === raid.bossId) ?? raidBoss(raid.week);

/** Place d'un joueur dans un raid : à dégâts égaux, le premier à avoir attaqué est devant. */
async function rankIn(week: string, participant: { damage: number; firstAt: Date }): Promise<number> {
  const ahead = await db().raidParticipant.count({
    where: { week, OR: [{ damage: { gt: participant.damage } }, { damage: participant.damage, firstAt: { lt: participant.firstAt } }] },
  });
  return ahead + 1;
}

/** Butins que le joueur n'a pas encore récupérés, sur les raids vaincus auxquels il a pris part. */
async function pendingLoot(userId: string): Promise<RaidLootView[]> {
  const waiting = await db().raidParticipant.findMany({
    where: { userId, claimed: false, damage: { gte: RAID_LOOT.minDamage }, raid: { defeatedAt: { not: null } } },
    include: { raid: { select: { bossId: true } } },
    orderBy: { week: "desc" },
    take: 5,
  });
  return Promise.all(
    waiting.map(async (participant) => {
      const rank = await rankIn(participant.week, participant);
      return { week: participant.week, bossId: participant.raid.bossId, rank, golden: rank <= RAID_LOOT.podium, berrys: RAID_LOOT.berrys };
    }),
  );
}

/** Nombre de butins en attente, pour la cloche de l'en-tête. */
export function pendingLootCount(userId: string): Promise<number> {
  return db().raidParticipant.count({
    where: { userId, claimed: false, damage: { gte: RAID_LOOT.minDamage }, raid: { defeatedAt: { not: null } } },
  });
}

export async function raidView(userId: string | null, today = dailyKey()): Promise<RaidView> {
  const week = weekKey(today);
  const raid = await ensureRaid(week);
  const [top, participants, mine, attacksToday, loot] = await Promise.all([
    db().raidParticipant.findMany({
      where: { week, damage: { gt: 0 } },
      orderBy: [{ damage: "desc" }, { firstAt: "asc" }],
      take: LEADERBOARD_SIZE,
      include: { user: { select: { username: true, cosmetics: true, equipped: true } } },
    }),
    db().raidParticipant.count({ where: { week } }),
    userId ? db().raidParticipant.findUnique({ where: { week_userId: { week, userId } } }) : null,
    userId ? db().raidAttack.count({ where: { userId, dayKey: today } }) : 0,
    userId ? pendingLoot(userId) : [],
  ]);

  return {
    week,
    daysLeft: daysLeftInWeek(today),
    boss: { id: raid.bossId, kind: bossOf(raid).kind },
    hp: raid.hp,
    damage: Math.min(raid.damage, raid.hp),
    defeated: raid.defeatedAt !== null,
    participants,
    leaderboard: top.map((row, index) => ({
      rank: index + 1,
      username: row.user.username,
      damage: row.damage,
      you: row.userId === userId,
      look: sanitizeCosmetics(row.user.cosmetics, row.user.equipped).equipped,
    })),
    you: userId
      ? {
          damage: mine?.damage ?? 0,
          attacks: mine?.attacks ?? 0,
          rank: mine && mine.damage > 0 ? await rankIn(week, mine) : null,
          attacksLeft: Math.max(0, RAID_ATTACKS_PER_DAY - attacksToday),
        }
      : null,
    loot,
  };
}

const questionsOf = (attack: { seed: number; mode: string; lang: string }) =>
  generateMixed(attack.seed, MIX_SLUGS, RAID_QUESTIONS, "normal", gameData(attack.mode as SpoilerMode, attack.lang as Locale));

/**
 * Lance un assaut : le serveur tire les questions et n'en envoie que
 * l'énoncé. La graine reste en base, les réponses ne partent qu'à la fin.
 * Un assaut lancé compte dans la limite du jour, qu'il soit terminé ou non :
 * on ne relance pas un tirage qui déplaît.
 */
export async function startRaidAttack(userId: string, mode: SpoilerMode, lang: Locale, today = dailyKey()): Promise<RaidStartResult> {
  const raid = await ensureRaid(weekKey(today));
  if (raid.defeatedAt) return { ok: false, error: "defeated" };
  const used = await db().raidAttack.count({ where: { userId, dayKey: today } });
  if (used >= RAID_ATTACKS_PER_DAY) return { ok: false, error: "limit" };

  const attack = await db().raidAttack.create({
    data: { week: raid.week, userId, seed: randomInt(0, 0x7fffffff), mode, lang, dayKey: today },
  });
  // Deux lancements simultanés peuvent passer le contrôle ensemble : le plus récent est retiré
  if ((await db().raidAttack.count({ where: { userId, dayKey: today } })) > RAID_ATTACKS_PER_DAY) {
    await db().raidAttack.delete({ where: { id: attack.id } });
    return { ok: false, error: "limit" };
  }
  return {
    ok: true,
    attackId: attack.id,
    questions: questionsOf(attack).map(({ title, subject, detail, img, options }) => ({ title, subject, detail, img, options })),
  };
}

/**
 * Termine un assaut. Les réponses viennent du navigateur ; le serveur rejoue
 * le tirage, compte les bonnes réponses et fixe les dégâts, bonus d'équipage
 * compris. Un assaut rendu après le délai ne compte pas.
 */
export async function finishRaidAttack(userId: string, attackId: string, answers: readonly unknown[]): Promise<RaidAttackResult> {
  const attack = await db().raidAttack.findFirst({ where: { id: attackId, userId, finishedAt: null } });
  if (!attack) return { ok: false, error: "not-found" };
  if (Date.now() - attack.startedAt.getTime() > RAID_ATTACK_MS) {
    await db().raidAttack.updateMany({ where: { id: attack.id, finishedAt: null }, data: { finishedAt: new Date() } });
    return { ok: false, error: "expired" };
  }

  const questions = questionsOf(attack);
  const correct = questions.filter((question, index) => answers[index] === question.answerId).length;
  const data = gameData(attack.mode as SpoilerMode);

  const result = await db().$transaction(async (tx) => {
    const crewBonus = raidCrewBonus(await loadState(userId, tx), data.characterById);
    const damage = raidDamage(correct, crewBonus);
    // L'assaut ne se termine qu'une fois : un second envoi ne frappe pas deux fois
    const closed = await tx.raidAttack.updateMany({
      where: { id: attack.id, finishedAt: null },
      data: { finishedAt: new Date(), correct, damage },
    });
    if (closed.count === 0) return { ok: false, error: "not-found" } as const;

    await tx.raidParticipant.upsert({
      where: { week_userId: { week: attack.week, userId } },
      create: { week: attack.week, userId, damage, attacks: 1 },
      update: { damage: { increment: damage }, attacks: { increment: 1 } },
    });
    const raid = await tx.raid.update({ where: { week: attack.week }, data: { damage: { increment: damage } } });
    const finisher =
      raid.damage >= raid.hp &&
      (await tx.raid.updateMany({ where: { week: attack.week, defeatedAt: null }, data: { defeatedAt: new Date() } })).count > 0;

    const berrys = await creditPlay(tx, userId, raidAttackBerrys(damage));
    await tx.raidAttack.update({ where: { id: attack.id }, data: { berrys } });
    return {
      ok: true,
      correct,
      damage,
      crewBonus,
      berrys,
      answers: questions.map((question) => ({ answerId: question.answerId, explanation: question.explanation })),
      finisher,
      state: await loadState(userId, tx),
    } as const;
  });
  if (result.ok && result.finisher) await announceDefeat(attack.week, userId);
  return result;
}

/**
 * L'adversaire vient de tomber : les joueurs qui ont droit au butin sont
 * prévenus sur leurs appareils. Celui qui a porté le dernier coup l'apprend à
 * l'écran. Ne lève jamais d'erreur : l'assaut est déjà compté.
 */
async function announceDefeat(week: string, finisherId: string): Promise<void> {
  if (!pushEnabled) return;
  try {
    const raid = await db().raid.findUniqueOrThrow({ where: { week }, select: { bossId: true } });
    // Une seule requête pour tout le raid : seuls les joueurs qui ont un appareil abonné sont ensuite prévenus
    const devices = await db().pushSubscription.findMany({
      where: {
        session: {
          expiresAt: { gt: new Date() },
          userId: { not: finisherId },
          user: { raids: { some: { week, damage: { gte: RAID_LOOT.minDamage } } } },
        },
      },
      select: { session: { select: { userId: true } } },
    });
    const nameIn = (locale: Locale) => gameData("anime", locale).characterById.get(raid.bossId)?.name ?? raid.bossId;
    const boss = { fr: nameIn("fr"), en: nameIn("en") };
    const players = [...new Set(devices.map((device) => device.session.userId))];
    await Promise.all(players.map((playerId) => notify(playerId, { type: "raid-defeated", week, boss })));
  } catch (error) {
    console.error("Annonce du raid vaincu non envoyée", error);
  }
}

/** Récupère le butin d'un raid vaincu : des Berrys et l'avis de recherche de l'adversaire, doré pour le podium. */
export async function claimRaidLoot(userId: string, week: string): Promise<RaidClaimResult> {
  const participant = await db().raidParticipant.findUnique({
    where: { week_userId: { week, userId } },
    include: { raid: { select: { bossId: true, defeatedAt: true } } },
  });
  if (!participant || participant.claimed || !participant.raid.defeatedAt) return { ok: false, error: "not-found" };
  if (participant.damage < RAID_LOOT.minDamage) return { ok: false, error: "not-eligible" };

  // Le raid est vaincu : plus aucun assaut ne change le classement
  const podium = (await rankIn(week, participant)) <= RAID_LOOT.podium;
  return db().$transaction(async (tx) => {
    const claimed = await tx.raidParticipant.updateMany({ where: { week, userId, claimed: false }, data: { claimed: true } });
    if (claimed.count === 0) return { ok: false, error: "not-found" } as const;

    await addToCollection(tx, userId, participant.raid.bossId, podium);
    // Le butin est une prime, pas un gain de partie : il échappe au plafond du jour
    await tx.user.update({
      where: { id: userId },
      data: { berrys: { increment: RAID_LOOT.berrys }, lifetimeBerrys: { increment: RAID_LOOT.berrys } },
    });
    const cosmetic = podium && (await grantCosmeticTo(tx, userId, RAID_LOOT.cosmetic)) ? RAID_LOOT.cosmetic : null;
    return {
      ok: true,
      berrys: RAID_LOOT.berrys,
      characterId: participant.raid.bossId,
      golden: podium,
      cosmetic,
      state: await loadState(userId, tx),
    } as const;
  });
}
