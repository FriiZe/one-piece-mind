import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { buildGameData, resolveGameData, type GameData, type ResolvedData } from "@/games/cards";
import { dailyKey } from "@/games/engine/daily";
import type { Difficulty } from "@/games/engine/difficulty";
import { generateMixed, type MixSlug, type QcmQuestion } from "@/games/qcm/logic";
import { DAILY_BERRY_CAP } from "@/lib/economy";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import {
  ANSWER_SECONDS,
  cleanName,
  MAX_PLAYERS,
  nameKey,
  normalizeCode,
  pointsFor,
  PRESENCE_SECONDS,
  QUESTION_COUNTS,
  randomCode,
  rank,
  REVEAL_SECONDS,
  roomBerrys,
  validGames,
} from "@/lib/multi/rules";
import type { Result, RoomSettings, RoomTicket, RoomView } from "@/lib/multi/types";
import type { SpoilerMode } from "@/lib/spoilers";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { notify } from "./push";
import { DUEL_MAX_MS, duelView, settleDuel } from "./ranked";
import type { SessionUser } from "./session";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
/** La graine est stockée dans une colonne entière de Postgres, limitée à 31 bits. */
const MAX_SEED = 0x7fffffff;

const raw = new Map<Locale, GameData>();
const resolved = new Map<string, ResolvedData>();
function gameData(mode: SpoilerMode, locale: Locale): ResolvedData {
  const key = `${locale}:${mode}`;
  if (!resolved.has(key)) {
    if (!raw.has(locale)) raw.set(locale, buildGameData(locale));
    resolved.set(key, resolveGameData(raw.get(locale)!, mode));
  }
  return resolved.get(key)!;
}

/** Langue d'un salon : celle de son hôte. Un salon créé avant l'arrivée de l'anglais est en français. */
const roomLocale = (room: { lang: string }): Locale => (isLocale(room.lang) ? room.lang : DEFAULT_LOCALE);

type RoomRow = Prisma.RoomGetPayload<{ include: { players: true } }>;

/** Questions d'un salon : recalculées à partir de la graine, et gardées en mémoire le temps de la partie. */
const questionCache = new Map<string, QcmQuestion[]>();
function questionsOf(room: Pick<RoomRow, "id" | "seed" | "mode" | "lang" | "difficulty" | "games" | "questionCount">): QcmQuestion[] {
  const key = `${room.id}:${room.seed}`;
  let questions = questionCache.get(key);
  if (!questions) {
    questions = generateMixed(
      room.seed,
      room.games as MixSlug[],
      room.questionCount,
      room.difficulty as Difficulty,
      gameData(room.mode as SpoilerMode, roomLocale(room)),
    );
    if (questionCache.size > 200) questionCache.delete(questionCache.keys().next().value!);
    questionCache.set(key, questions);
  }
  return questions;
}

export type Identity = { user: SessionUser | null; name?: string };

/** Pseudo sous lequel le joueur apparaît : celui du compte, ou celui choisi par l'invité. */
function displayName(identity: Identity): string | null {
  return identity.user ? identity.user.username : cleanName(identity.name ?? "");
}

function parseSettings(input: unknown): RoomSettings | null {
  if (typeof input !== "object" || input === null) return null;
  const { mode, difficulty, games, questionCount, seconds, lang } = input as Record<string, unknown>;
  const validGameList = validGames(games);
  if (mode !== "anime" && mode !== "manga") return null;
  if (difficulty !== "facile" && difficulty !== "normal" && difficulty !== "expert") return null;
  if (!validGameList) return null;
  if (!(QUESTION_COUNTS as readonly unknown[]).includes(questionCount)) return null;
  if (!(ANSWER_SECONDS as readonly unknown[]).includes(seconds)) return null;
  return {
    mode,
    difficulty,
    games: validGameList,
    questionCount: questionCount as number,
    seconds: seconds as number,
    lang: isLocale(lang) ? lang : DEFAULT_LOCALE,
  };
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

function newTicket(code: string, playerId: string): { ticket: RoomTicket; tokenHash: string } {
  const token = randomBytes(24).toString("base64url");
  return { ticket: { code, playerId, token }, tokenHash: hashToken(token) };
}

export async function createRoom(input: unknown, identity: Identity): Promise<Result<{ ticket: RoomTicket }>> {
  const settings = parseSettings(input);
  if (!settings) return { ok: false, error: "bad-request" };
  const name = displayName(identity);
  if (!name) return { ok: false, error: "bad-name" };

  // Les salons de la veille ne servent plus à personne
  await db().room.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } });

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode(randomInt);
    const token = randomBytes(24).toString("base64url");
    try {
      const room = await db().room.create({
        data: {
          code,
          ...settings,
          seed: randomInt(0, MAX_SEED),
          players: { create: { name, nameKey: nameKey(name), userId: identity.user?.id ?? null, tokenHash: hashToken(token) } },
        },
        include: { players: true },
      });
      await db().room.update({ where: { id: room.id }, data: { hostId: room.players[0].id } });
      return { ok: true, ticket: { code, playerId: room.players[0].id, token } };
    } catch (error) {
      // Code déjà pris : on en tire un autre
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return { ok: false, error: "unavailable" };
}

export async function joinRoom(codeInput: string, identity: Identity): Promise<Result<{ ticket: RoomTicket }>> {
  const code = normalizeCode(codeInput);
  const room = await db().room.findUnique({ where: { code }, include: { players: true } });
  if (!room) return { ok: false, error: "not-found" };

  // Un joueur connecté qui revient retrouve sa place, même en cours de partie
  const mine = identity.user ? room.players.find((p) => p.userId === identity.user!.id) : undefined;
  if (mine) {
    const { ticket, tokenHash } = newTicket(code, mine.id);
    await db().roomPlayer.update({ where: { id: mine.id }, data: { tokenHash, lastSeenAt: new Date() } });
    return { ok: true, ticket };
  }

  if (room.status !== "lobby") return { ok: false, error: "started" };
  if (room.players.length >= MAX_PLAYERS) return { ok: false, error: "full" };
  const name = displayName(identity);
  if (!name) return { ok: false, error: "bad-name" };

  const token = randomBytes(24).toString("base64url");
  try {
    const player = await db().roomPlayer.create({
      data: { roomId: room.id, name, nameKey: nameKey(name), userId: identity.user?.id ?? null, tokenHash: hashToken(token) },
    });
    await db().room.update({ where: { id: room.id }, data: { version: { increment: 1 } } });
    return { ok: true, ticket: { code, playerId: player.id, token } };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "name-taken" };
    throw error;
  }
}

/** Le salon et le joueur désignés par un ticket, si le jeton est le bon. */
async function authenticate(ticket: RoomTicket): Promise<{ room: RoomRow; player: RoomRow["players"][number] } | null> {
  const room = await db().room.findUnique({ where: { code: normalizeCode(ticket.code) }, include: { players: true } });
  const player = room?.players.find((p) => p.id === ticket.playerId);
  if (!room || !player || player.tokenHash !== hashToken(ticket.token)) return null;
  return { room, player };
}

const isPresent = (lastSeenAt: Date, now: number) => now - lastSeenAt.getTime() < PRESENCE_SECONDS * 1000;

/**
 * Fait avancer la partie si son heure est venue. Aucun processus ne tourne en
 * fond : c'est la prochaine requête d'un joueur, quel qu'il soit, qui
 * constate que le temps est écoulé et passe à l'étape suivante.
 */
async function advance(room: RoomRow): Promise<RoomRow> {
  for (let step = 0; step < 4; step++) {
    if (room.status !== "playing" || !room.phaseEndsAt) return room;
    const now = Date.now();
    const total = questionsOf(room).length;
    let data: Prisma.RoomUpdateManyMutationInput | null = null;

    if (room.phase === "countdown") {
      // Duel classé : les deux joueurs ont eu le temps d'arriver, la première question part
      if (now >= room.phaseEndsAt.getTime()) {
        data = { phase: "question", phaseStartedAt: new Date(now), phaseEndsAt: new Date(now + room.seconds * 1000) };
      }
    } else if (room.phase === "question") {
      const present = room.players.filter((p) => isPresent(p.lastSeenAt, now));
      const answered = await db().roomAnswer.findMany({
        where: { roomId: room.id, questionIndex: room.questionIndex },
        select: { playerId: true },
      });
      const done = new Set(answered.map((a) => a.playerId));
      const everyoneAnswered = present.length > 0 && present.every((p) => done.has(p.id));
      if (now >= room.phaseEndsAt.getTime() || everyoneAnswered) {
        data = { phase: "reveal", phaseStartedAt: new Date(now), phaseEndsAt: new Date(now + REVEAL_SECONDS * 1000) };
      }
    } else if (now >= room.phaseEndsAt.getTime()) {
      data =
        room.questionIndex + 1 >= total
          ? { status: "finished", phaseEndsAt: null }
          : {
              questionIndex: room.questionIndex + 1,
              phase: "question",
              phaseStartedAt: new Date(now),
              phaseEndsAt: new Date(now + room.seconds * 1000),
            };
    }
    if (!data) return room;

    // La version sert de verrou : si un autre joueur a déjà fait avancer la partie, on relit simplement
    await db().room.updateMany({ where: { id: room.id, version: room.version }, data: { ...data, version: { increment: 1 } } });
    room = await db().room.findUniqueOrThrow({ where: { id: room.id }, include: { players: true } });
  }
  return room;
}

/** Verse au joueur les Berrys de la partie terminée, une seule fois, dans la limite du plafond du jour. */
async function claimReward(room: RoomRow, player: RoomRow["players"][number]): Promise<number> {
  if (!player.userId || room.status !== "finished") return 0;
  if (player.rewarded) return player.rewardBerrys;

  const ranking = rank(room.players.map((p) => ({ id: p.id, score: p.score, joinedAt: p.joinedAt.getTime() })));
  const mine = ranking.find((p) => p.id === player.id)!;
  const wanted = roomBerrys(player.score, questionsOf(room).length, mine.rank, room.players.length);
  const today = dailyKey();

  return db().$transaction(async (tx) => {
    const claimed = await tx.roomPlayer.updateMany({ where: { id: player.id, rewarded: false }, data: { rewarded: true } });
    if (claimed.count === 0) return (await tx.roomPlayer.findUniqueOrThrow({ where: { id: player.id } })).rewardBerrys;

    const user = await tx.user.findUniqueOrThrow({ where: { id: player.userId! }, select: { dayKey: true, dayEarned: true } });
    const earnedToday = user.dayKey === today ? user.dayEarned : 0;
    const berrys = Math.max(0, Math.min(wanted, DAILY_BERRY_CAP - earnedToday));
    await tx.user.update({
      where: { id: player.userId! },
      data: {
        berrys: { increment: berrys },
        lifetimeBerrys: { increment: berrys },
        games: { increment: 1 },
        dayKey: today,
        dayEarned: earnedToday + berrys,
        // Premier gain de la journée : les jeux du jour validés la veille ne comptent plus
        ...(user.dayKey === today ? {} : { dayDone: [] }),
      },
    });
    await tx.roomPlayer.update({ where: { id: player.id }, data: { rewardBerrys: berrys } });
    return berrys;
  });
}

async function toView(room: RoomRow, player: RoomRow["players"][number]): Promise<RoomView> {
  const now = Date.now();
  const questions = room.status === "lobby" ? [] : questionsOf(room);
  const counting = room.status === "playing" && room.phase === "countdown";
  const current = room.status === "playing" && !counting ? questions[room.questionIndex] : undefined;
  const answers = current
    ? await db().roomAnswer.findMany({ where: { roomId: room.id, questionIndex: room.questionIndex } })
    : [];
  const answeredBy = new Set(answers.map((a) => a.playerId));
  const mine = answers.find((a) => a.playerId === player.id);

  const revealing = room.phase === "reveal";
  // Tant que la correction n'est pas affichée, les points de la question en cours restent cachés :
  // voir un score monter dirait aux autres que ce joueur a trouvé
  const hidden = new Map(revealing ? [] : answers.map((a) => [a.playerId, a.points]));
  const ranking = rank(
    room.players.map((p) => ({ ...p, score: p.score - (hidden.get(p.id) ?? 0), joinedAt: p.joinedAt.getTime() })),
  );

  return {
    code: room.code,
    version: room.version,
    kind: room.kind === "ranked" ? "ranked" : "friendly",
    status: room.status as RoomView["status"],
    startsAt: counting ? room.phaseEndsAt!.getTime() : null,
    ranked: room.kind === "ranked" ? await duelView(room, player.id) : null,
    settings: {
      mode: room.mode as SpoilerMode,
      difficulty: room.difficulty as Difficulty,
      games: room.games as MixSlug[],
      questionCount: room.questionCount,
      seconds: room.seconds,
      lang: roomLocale(room),
    },
    you: { id: player.id, isHost: room.hostId === player.id },
    players: ranking.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      rank: p.rank,
      isHost: room.hostId === p.id,
      connected: isPresent(p.lastSeenAt, now),
      answered: answeredBy.has(p.id),
    })),
    serverNow: now,
    question: current
      ? {
          index: room.questionIndex,
          total: questions.length,
          title: current.title,
          subject: current.subject,
          detail: current.detail,
          img: current.img,
          options: current.options,
          endsAt: revealing ? (room.phaseStartedAt ?? new Date(now)).getTime() : room.phaseEndsAt!.getTime(),
          yourAnswer: mine?.optionId ?? null,
          reveal: revealing
            ? {
                answerId: current.answerId,
                explanation: current.explanation,
                counts: Object.fromEntries(
                  current.options.map((o) => [o.id, answers.filter((a) => a.optionId === o.id).length]),
                ),
                yourPoints: mine?.points ?? 0,
                nextAt: room.phaseEndsAt!.getTime(),
              }
            : null,
        }
      : null,
    reward: room.status === "finished" && player.userId ? { berrys: await claimReward(room, player) } : null,
  };
}

/**
 * État du salon vu par un joueur. `knownVersion` : la version que le joueur a
 * déjà ; si rien n'a changé depuis, on le lui dit sans tout renvoyer.
 */
export async function viewRoom(
  ticket: RoomTicket,
  knownVersion?: number,
): Promise<Result<{ view: RoomView } | { unchanged: true; serverNow: number }>> {
  const found = await authenticate(ticket);
  if (!found) return { ok: false, error: "not-found" };
  let { room, player } = found;

  // Signe de vie, écrit au plus toutes les quelques secondes pour ménager la base
  if (Date.now() - player.lastSeenAt.getTime() > 4000) {
    await db().roomPlayer.update({ where: { id: player.id }, data: { lastSeenAt: new Date() } });
    player = { ...player, lastSeenAt: new Date() };
    room = { ...room, players: room.players.map((p) => (p.id === player.id ? player : p)) };
  }
  room = await advance(room);
  // Duel classé terminé : les cotes sont mises à jour par la première requête qui le constate
  if (room.kind === "ranked" && room.status === "finished" && !room.settledAt && (await settleDuel(room))) {
    room = await db().room.findUniqueOrThrow({ where: { id: room.id }, include: { players: true } });
  }

  const pendingReward = room.status === "finished" && player.userId !== null && !player.rewarded;
  if (knownVersion === room.version && !pendingReward) return { ok: true, unchanged: true, serverNow: Date.now() };
  return { ok: true, view: await toView(room, room.players.find((p) => p.id === player.id)!) };
}

export async function startRoom(ticket: RoomTicket): Promise<Result<object>> {
  const found = await authenticate(ticket);
  if (!found) return { ok: false, error: "not-found" };
  const { room, player } = found;
  if (room.hostId !== player.id) return { ok: false, error: "forbidden" };
  if (room.status !== "lobby") return { ok: false, error: "started" };
  if (questionsOf(room).length === 0) return { ok: false, error: "unavailable" };

  const now = Date.now();
  await db().room.updateMany({
    where: { id: room.id, status: "lobby" },
    data: {
      status: "playing",
      questionIndex: 0,
      phase: "question",
      phaseStartedAt: new Date(now),
      phaseEndsAt: new Date(now + room.seconds * 1000),
      version: { increment: 1 },
    },
  });
  // Les invitations n'ont plus lieu d'être une fois la partie lancée
  await db().roomInvite.deleteMany({ where: { roomId: room.id } });
  return { ok: true };
}

/** Marge accordée à une réponse partie juste avant la fin du chrono. */
const LATE_GRACE_MS = 600;

export async function answerRoom(ticket: RoomTicket, questionIndex: unknown, optionId: unknown): Promise<Result<object>> {
  const found = await authenticate(ticket);
  if (!found) return { ok: false, error: "not-found" };
  const { room, player } = found;
  if (typeof optionId !== "string" || typeof questionIndex !== "number") return { ok: false, error: "bad-request" };
  if (room.status !== "playing" || room.phase !== "question" || room.questionIndex !== questionIndex) {
    return { ok: false, error: "forbidden" };
  }
  const now = Date.now();
  if (!room.phaseStartedAt || !room.phaseEndsAt || now > room.phaseEndsAt.getTime() + LATE_GRACE_MS) {
    return { ok: false, error: "forbidden" };
  }
  const question = questionsOf(room)[room.questionIndex];
  if (!question.options.some((o) => o.id === optionId)) return { ok: false, error: "bad-request" };

  const correct = optionId === question.answerId;
  const points = pointsFor(correct, now - room.phaseStartedAt.getTime(), room.seconds * 1000);
  try {
    await db().$transaction([
      db().roomAnswer.create({ data: { roomId: room.id, playerId: player.id, questionIndex, optionId, correct, points } }),
      db().roomPlayer.update({ where: { id: player.id }, data: { score: { increment: points }, lastSeenAt: new Date(now) } }),
      db().room.update({ where: { id: room.id }, data: { version: { increment: 1 } } }),
    ]);
  } catch (error) {
    // Une seule réponse par question : la seconde est ignorée
    if (!isUniqueViolation(error)) throw error;
  }
  return { ok: true };
}

/** L'hôte relance une partie avec les mêmes joueurs : retour au salon d'attente, scores remis à zéro. */
export async function restartRoom(ticket: RoomTicket): Promise<Result<object>> {
  const found = await authenticate(ticket);
  if (!found) return { ok: false, error: "not-found" };
  const { room, player } = found;
  // Un duel classé ne se relance pas : la revanche passe par la file d'attente
  if (room.hostId !== player.id || room.status !== "finished" || room.kind === "ranked") return { ok: false, error: "forbidden" };

  await db().$transaction([
    db().roomAnswer.deleteMany({ where: { roomId: room.id } }),
    db().roomPlayer.updateMany({ where: { roomId: room.id }, data: { score: 0, rewarded: false, rewardBerrys: 0 } }),
    db().room.update({
      where: { id: room.id },
      data: {
        status: "lobby",
        seed: randomInt(0, MAX_SEED),
        questionIndex: 0,
        phase: "question",
        phaseStartedAt: null,
        phaseEndsAt: null,
        version: { increment: 1 },
      },
    }),
  ]);
  return { ok: true };
}

/** Invite un ami dans le salon : il faut y être soi-même, avec un compte, et que la partie n'ait pas commencé. */
export async function inviteToRoom(ticket: RoomTicket, user: SessionUser | null, friendId: unknown): Promise<Result<object>> {
  const found = await authenticate(ticket);
  if (!found) return { ok: false, error: "not-found" };
  if (!user || found.player.userId !== user.id || typeof friendId !== "string") return { ok: false, error: "forbidden" };
  if (found.room.status !== "lobby") return { ok: false, error: "started" };

  const friendship = await db().friendship.findFirst({
    where: {
      status: "accepted",
      OR: [
        { requesterId: user.id, addresseeId: friendId },
        { requesterId: friendId, addresseeId: user.id },
      ],
    },
  });
  if (!friendship) return { ok: false, error: "forbidden" };

  await db().roomInvite.upsert({
    where: { roomId_toId: { roomId: found.room.id, toId: friendId } },
    create: { roomId: found.room.id, fromId: user.id, toId: friendId },
    update: { fromId: user.id, createdAt: new Date() },
  });
  await notify(friendId, { type: "room-invite", from: user.username, code: found.room.code });
  return { ok: true };
}

/**
 * Solde les duels classés que le joueur a laissés en plan. Un salon n'avance
 * que lorsqu'on l'interroge : si les deux joueurs sont partis avant la fin, le
 * duel est arrêté ici, sur les points marqués, pour que partir ne permette pas
 * d'éviter une défaite. À appeler quand le joueur revient dans la file.
 */
export async function finishStaleDuels(userId: string): Promise<void> {
  const seats = await db().roomPlayer.findMany({
    where: { userId, room: { kind: "ranked", settledAt: null, createdAt: { lt: new Date(Date.now() - DUEL_MAX_MS) } } },
    select: { roomId: true },
  });
  for (const { roomId } of seats) {
    await db().room.updateMany({
      where: { id: roomId, status: "playing" },
      data: { status: "finished", phaseEndsAt: null, version: { increment: 1 } },
    });
    const room = await db().room.findUnique({ where: { id: roomId }, include: { players: true } });
    if (room?.status === "finished") await settleDuel(room);
  }
}
