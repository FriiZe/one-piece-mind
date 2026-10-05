import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildGameData, resolveGameData } from "@/games/cards";
import { dailyKey } from "@/games/engine/daily";
import { generateMixed, MIX_SLUGS } from "@/games/qcm/logic";
import {
  buyCosmetic,
  COSMETIC_DEFAULTS,
  COSMETIC_SLOT_LABELS,
  COSMETIC_SLOTS,
  COSMETICS,
  DUPLICATE_VALUE,
  EMPTY_PLAYER,
  equipCosmetic,
  getCosmetic,
  grantCosmetic,
  normalizePlayer,
  sanitizeCosmetics,
  weekKey,
  type PlayerState,
} from "@/lib/economy";
import { isValidPrice, MARKET_MAX_LISTINGS, marketProceeds, marketTax, priceBounds, sellableCopies } from "@/lib/market/rules";
import { MARKET_ERRORS } from "@/lib/market/types";
import type { RoomTicket, RoomView } from "@/lib/multi/types";
import {
  BOSS_KINDS,
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
import { RAID_ERRORS } from "@/lib/raid/types";
import {
  applyDelta,
  canPair,
  duelOutcome,
  leagueOf,
  LEAGUES,
  MAX_PAIR_DUELS_PER_DAY,
  RANKED_SETTINGS,
  RATING_FLOOR,
  ratingDelta,
  ratingWindow,
  rollSeason,
  seasonDaysLeft,
  seasonKey,
  START_RATING,
} from "@/lib/ranked/rules";
import { accountsEnabled, db } from "@/lib/server/db";
import { establish } from "./established";
import { pendingCounts } from "@/lib/server/friends";
import { acknowledgeSales, buyListing, cancelListing, createListing, marketOverview, type MarketFilters } from "@/lib/server/market";
import { DUMMY_HASH } from "@/lib/server/password";
import { buyCosmeticFor, equipCosmeticFor, loadState, sanitizeGuestState } from "@/lib/server/player";
import { claimRaidLoot, finishRaidAttack, raidView, startRaidAttack } from "@/lib/server/raid";
import { joinQueue, leaveQueue, pollQueue, rankedOverview } from "@/lib/server/ranked";
import { answerRoom, finishStaleDuels, joinRoom, restartRoom, viewRoom } from "@/lib/server/rooms";

const anime = resolveGameData(buildGameData(), "anime");
const player = (overrides: Partial<PlayerState> = {}): PlayerState => ({ ...EMPTY_PLAYER, ...overrides });

describe("classé : cote, ligues et saisons", () => {
  it("départage un duel aux points", () => {
    expect(duelOutcome(5200, 4100)).toBe(1);
    expect(duelOutcome(4100, 5200)).toBe(0);
    expect(duelOutcome(3000, 3000)).toBe(0.5);
  });

  it("fait gagner au vainqueur ce que perd le vaincu, et davantage contre plus fort", () => {
    expect(ratingDelta(1000, 1000, 1)).toBe(16);
    expect(ratingDelta(1000, 1000, 0)).toBe(-16);
    expect(ratingDelta(1000, 1000, 0.5)).toBe(0);
    const upset = ratingDelta(1000, 1400, 1);
    expect(upset).toBeGreaterThan(25);
    expect(ratingDelta(1400, 1000, 0)).toBe(-upset);
    // Battre beaucoup plus faible ne rapporte presque rien
    expect(ratingDelta(1400, 1000, 1)).toBeLessThan(5);
    expect(applyDelta(RATING_FLOOR + 5, -30)).toBe(RATING_FLOOR);
  });

  it("range chaque cote dans une ligue", () => {
    expect(leagueOf(START_RATING).league.id).toBe("east-blue");
    expect(leagueOf(1099).next?.id).toBe("reverse-mountain");
    expect(leagueOf(1100).league.id).toBe("reverse-mountain");
    expect(leagueOf(1325)).toMatchObject({ league: { id: "paradis" }, progress: 0.5 });
    expect(leagueOf(2400)).toMatchObject({ league: { id: "laugh-tale" }, next: null, progress: 1 });
    expect(leagueOf(0).league.id).toBe("east-blue");
    for (const league of LEAGUES) {
      expect(league.title.fr, league.id).not.toBe("");
      expect(league.title.en, league.id).not.toBe("");
      // Le titre offert en fin de saison existe, et ne s'achète pas
      if (league.cosmetic) expect(getCosmetic(league.cosmetic)).toMatchObject({ slot: "title", price: null });
    }
  });

  it("fait durer une saison un mois", () => {
    expect(seasonKey("2026-10-17")).toBe("2026-10");
    expect(seasonDaysLeft("2026-10-01")).toBe(31);
    expect(seasonDaysLeft("2026-10-31")).toBe(1);
    expect(seasonDaysLeft("2027-02-28")).toBe(1);
    expect(seasonDaysLeft("2028-02-28")).toBe(2);
    expect(seasonDaysLeft("2026-12-25")).toBe(7);
  });

  it("solde la saison passée et rapproche la cote du départ", () => {
    const current = { season: "2026-10", rating: 1450, games: 12, wins: 8 };
    expect(rollSeason(current, "2026-10")).toEqual({ profile: current, result: null });

    const rolled = rollSeason(current, "2026-11");
    expect(rolled.profile).toEqual({ season: "2026-11", rating: 1225, games: 0, wins: 0 });
    expect(rolled.result).toEqual({ season: "2026-10", rating: 1450, games: 12, wins: 8, berrys: 10_000, cosmetic: "title-nouveau-monde" });

    // Trop peu de duels : la saison est notée, sans prime
    expect(rollSeason({ ...current, games: 2 }, "2026-11").result).toMatchObject({ berrys: 0, cosmetic: null });
    // Jamais joué : rien à solder
    expect(rollSeason({ season: "", rating: START_RATING, games: 0, wins: 0 }, "2026-11")).toEqual({
      profile: { season: "2026-11", rating: START_RATING, games: 0, wins: 0 },
      result: null,
    });
  });

  it("élargit l'écart de cote toléré avec l'attente", () => {
    expect(ratingWindow(0)).toBe(100);
    expect(ratingWindow(12_000)).toBe(200);
    expect(ratingWindow(30_000)).toBe(Infinity);
    expect(canPair(1000, 0, 1090, 0)).toBe(true);
    expect(canPair(1000, 0, 1300, 0)).toBe(false);
    // Le plus patient des deux décide
    expect(canPair(1000, 0, 1300, 21_000)).toBe(true);
    expect(canPair(1000, 31_000, 2000, 0)).toBe(true);
  });
});

describe("raid : adversaire, dégâts et butin", () => {
  it("fait tourner les adversaires, tous connus de l'anime", () => {
    for (const boss of RAID_BOSSES) expect(anime.characterById.has(boss.id), boss.id).toBe(true);
    expect(new Set(RAID_BOSSES.map((boss) => boss.id)).size).toBe(RAID_BOSSES.length);
    expect(raidBoss("2026-S40")).toBe(raidBoss("2026-S40"));
    const first = raidBoss("2026-S40");
    const second = raidBoss("2026-S41");
    expect(second.id).not.toBe(first.id);
    // Un Empereur, puis un Amiral
    expect(second.kind).not.toBe(first.kind);
    expect(BOSS_KINDS.fr[first.kind]).not.toBe(BOSS_KINDS.en[first.kind]);
    expect(getCosmetic(RAID_LOOT.cosmetic)).toMatchObject({ slot: "title", price: null });
  });

  it("frappe plus fort avec un bon équipage, et sans faute", () => {
    expect(raidDamage(0, 0)).toBe(0);
    expect(raidDamage(6, 0)).toBe(600);
    expect(raidDamage(6, 0.5)).toBe(900);
    expect(raidDamage(RAID_QUESTIONS, 0)).toBe(1250);
    expect(raidAttackBerrys(1250)).toBe(250);
    expect(raidAttackBerrys(0)).toBe(0);

    const legend = anime.characters.find((c) => c.tier === 1)!;
    const common = anime.characters.find((c) => c.tier === 4)!;
    const crew = player({
      collection: { [legend.id]: { count: 1, golden: 1 }, [common.id]: { count: 1, golden: 0 } },
      crew: { sabreur: legend.id, tireur: common.id, medecin: "personnage-absent" },
    });
    // Légendaire doré : 20 % × 1,5 ; commun : 5 % ; un poste dont l'avis n'est pas possédé ne compte pas
    expect(raidCrewBonus(crew, anime.characterById)).toBe(0.35);
    expect(raidCrewBonus(player(), anime.characterById)).toBe(0);
  });

  it("règle les points de vie sur le nombre de joueurs actifs", () => {
    expect(raidHp(0)).toBe(40_000);
    expect(raidHp(50)).toBe(200_000);
    expect(raidHp(10_000_000)).toBe(5_000_000);
  });
});

describe("marché : prix, taxe et exemplaires à vendre", () => {
  it("borne les prix selon la rareté", () => {
    expect(priceBounds(4, false)).toEqual({ min: DUPLICATE_VALUE[4], max: 2000, suggested: 300 });
    expect(priceBounds(1, true).min).toBe(4500);
    expect(isValidPrice(500, 4, false)).toBe(true);
    expect(isValidPrice(90, 4, false)).toBe(false);
    expect(isValidPrice(2010, 4, false)).toBe(false);
    expect(isValidPrice(505, 4, false)).toBe(false);
    expect(isValidPrice("500", 4, false)).toBe(false);
    expect(isValidPrice(500.5, 4, false)).toBe(false);
  });

  it("retient une taxe sur la vente", () => {
    expect(marketTax(1000)).toBe(100);
    expect(marketProceeds(1000)).toBe(900);
    expect(marketProceeds(150)).toBe(135);
  });

  it("laisse toujours un exemplaire au vendeur", () => {
    expect(sellableCopies(undefined)).toEqual({ plain: 0, golden: 0 });
    expect(sellableCopies({ count: 1, golden: 0 })).toEqual({ plain: 0, golden: 0 });
    expect(sellableCopies({ count: 3, golden: 0 })).toEqual({ plain: 2, golden: 0 });
    expect(sellableCopies({ count: 2, golden: 2 })).toEqual({ plain: 0, golden: 1 });
    // Un ordinaire et un doré : l'un ou l'autre peut partir
    expect(sellableCopies({ count: 2, golden: 1 })).toEqual({ plain: 1, golden: 1 });
  });

  it("explique chaque refus dans les deux langues", () => {
    for (const errors of [MARKET_ERRORS, RAID_ERRORS]) {
      expect(Object.keys(errors.en)).toEqual(Object.keys(errors.fr));
      for (const text of [...Object.values(errors.fr), ...Object.values(errors.en)]) expect(text).not.toBe("");
    }
  });
});

describe("cosmétiques", () => {
  it("existent dans les deux langues, chacun à un emplacement connu", () => {
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length);
    for (const cosmetic of COSMETICS) {
      expect(COSMETIC_SLOTS).toContain(cosmetic.slot);
      expect(cosmetic.name.fr, cosmetic.id).not.toBe("");
      expect(cosmetic.name.en, cosmetic.id).not.toBe("");
      // Ce qui ne s'achète pas dit comment on l'obtient
      if (cosmetic.price === null) expect(cosmetic.earned?.en, cosmetic.id).toBeTruthy();
      else expect(cosmetic.price).toBeGreaterThan(0);
    }
    for (const slot of COSMETIC_SLOTS) {
      expect(COSMETIC_SLOT_LABELS[slot].en).not.toBe("");
      expect(COSMETIC_DEFAULTS[slot].en).not.toBe("");
      expect(COSMETICS.some((c) => c.slot === slot && c.price !== null), slot).toBe(true);
    }
  });

  it("s'achètent en Berrys et se portent aussitôt", () => {
    const rich = player({ berrys: 10_000 });
    const bought = buyCosmetic(rich, "flag-rouge");
    if (typeof bought === "string") throw new Error(bought);
    expect(bought.cost).toBe(3000);
    expect(bought.state.berrys).toBe(7000);
    expect(bought.state.cosmetics).toEqual({ owned: ["flag-rouge"], equipped: { flag: "flag-rouge" } });
    // La prime du joueur ne bouge pas : un achat n'est pas un gain
    expect(bought.state.lifetimeBerrys).toBe(rich.lifetimeBerrys);

    expect(buyCosmetic(bought.state, "flag-rouge")).toBe("owned");
    expect(buyCosmetic(bought.state, "frame-empereur")).toBe("insufficient");
    expect(buyCosmetic(rich, "title-laugh-tale")).toBe("locked");
    expect(buyCosmetic(rich, "chapeau-de-paille")).toBe("unknown");
  });

  it("se retirent, et ne se portent que si on les possède", () => {
    const state = player({ cosmetics: { owned: ["flag-rouge", "title-chasseur"], equipped: { flag: "flag-rouge" } } });
    expect(equipCosmetic(state, "title", "title-chasseur")).toMatchObject({ cosmetics: { equipped: { flag: "flag-rouge", title: "title-chasseur" } } });
    expect(equipCosmetic(state, "flag", null)).toMatchObject({ cosmetics: { equipped: {} } });
    expect(equipCosmetic(state, "flag", "flag-or")).toBe("not-owned");
    // Un titre ne se porte pas à la place d'un pavillon
    expect(equipCosmetic(state, "flag", "title-chasseur")).toBe("unknown");
    expect(equipCosmetic(state, "chapeau", null)).toBe("unknown");
  });

  it("ne relit que ce qui existe", () => {
    expect(sanitizeCosmetics(["flag-rouge", "flag-rouge", "inconnu", 3], { flag: "flag-rouge", title: "title-chasseur", frame: "flag-rouge" })).toEqual({
      owned: ["flag-rouge"],
      equipped: { flag: "flag-rouge" },
    });
    expect(sanitizeCosmetics("n'importe quoi", null)).toEqual({ owned: [], equipped: {} });
    // Une progression d'invité enregistrée avant les cosmétiques est complétée
    expect(normalizePlayer({ berrys: 50 }).cosmetics).toEqual({ owned: [], equipped: {} });
    expect(grantCosmetic({ owned: [], equipped: {} }, "title-fleau")).toEqual({ owned: ["title-fleau"], equipped: {} });
    expect(grantCosmetic({ owned: [], equipped: {} }, "inconnu").owned).toEqual([]);
  });

  it("ne reprend d'un invité que les cosmétiques de la boutique", () => {
    const clean = sanitizeGuestState({
      berrys: 0,
      lifetimeBerrys: 0,
      games: 0,
      collection: {},
      crew: {},
      cosmetics: { owned: ["flag-rouge", "title-laugh-tale", "inconnu"], equipped: { flag: "flag-rouge", title: "title-laugh-tale" } },
    })!;
    expect(clean.cosmetics).toEqual({ owned: ["flag-rouge"], equipped: { flag: "flag-rouge" } });
  });
});

// Ces tests écrivent dans la base locale ; ils sont ignorés sans DATABASE_URL.
describe.skipIf(!accountsEnabled)("phase 5, en base", () => {
  const stamp = Date.now() % 1_000_000;
  // Une langue de file et une semaine de raid que rien d'autre n'utilise : les tests ne croisent pas de vrais joueurs
  const season = seasonKey(dailyKey());
  const raidDay = "2031-03-05";
  const raidWeek = weekKey(raidDay);
  const users: { id: string; username: string }[] = [];
  const roomCodes: string[] = [];

  beforeAll(async () => {
    for (const name of ["luffy", "zoro", "nami"]) {
      const username = `${name}_${stamp}`;
      users.push(await db().user.create({ data: { username, usernameKey: username, passwordHash: DUMMY_HASH }, select: { id: true, username: true } }));
    }
    // Le marché n'est ouvert qu'aux comptes qui ont joué plusieurs jours
    for (const user of users) await establish(user.id);
    // Aucun autre joueur ne doit attendre dans la file pendant ces tests
    await db().rankedQueue.deleteMany({});
  });
  afterAll(async () => {
    const ids = users.map((u) => u.id);
    await db().room.deleteMany({ where: { code: { in: roomCodes } } });
    await db().rankedMatch.deleteMany({ where: { OR: [{ playerAId: { in: ids } }, { playerBId: { in: ids } }] } });
    await db().raid.deleteMany({ where: { week: raidWeek } });
    await db().user.deleteMany({ where: { id: { in: ids } } });
    await db().$disconnect();
  });

  async function view(ticket: RoomTicket): Promise<RoomView> {
    const result = await viewRoom(ticket);
    if (!result.ok || !("view" in result)) throw new Error("vue indisponible");
    return result.view;
  }
  /** Avance l'horloge d'un salon en reculant ses échéances. */
  async function elapse(code: string, ms: number) {
    const room = await db().room.findUniqueOrThrow({ where: { code } });
    await db().room.update({
      where: { id: room.id },
      data: {
        phaseStartedAt: room.phaseStartedAt && new Date(room.phaseStartedAt.getTime() - ms),
        phaseEndsAt: room.phaseEndsAt && new Date(room.phaseEndsAt.getTime() - ms),
      },
    });
  }

  describe("duel classé", () => {
    let code: string;
    let tickets: RoomTicket[];

    it("réunit deux joueurs de la file dans un même duel", async () => {
      const [a, b, c] = users;
      expect(await pollQueue(a.id)).toEqual({ status: "idle" });
      expect(await joinQueue(a, "fr")).toMatchObject({ status: "searching" });
      // Une autre langue, une autre file
      expect(await joinQueue(c, "en")).toMatchObject({ status: "searching" });

      const found = await joinQueue(b, "fr");
      if (found.status !== "matched") throw new Error("pas d'adversaire");
      code = found.code;
      roomCodes.push(code);
      // Le premier arrivé l'apprend à sa prochaine demande, et retrouve le même duel s'il redemande
      expect(await pollQueue(a.id)).toEqual({ status: "matched", code });
      expect(await joinQueue(a, "fr")).toEqual({ status: "matched", code });
      expect(await pollQueue(c.id)).toMatchObject({ status: "searching" });
      await leaveQueue(c.id);
      expect(await pollQueue(c.id)).toEqual({ status: "idle" });
    });

    it("ouvre le salon sur un compte à rebours, réservé aux deux joueurs", async () => {
      const [a, b, c] = users;
      const joined = await Promise.all([joinRoom(code, { user: a }), joinRoom(code, { user: b })]);
      tickets = joined.map((result) => {
        if (!result.ok) throw new Error(result.error);
        return result.ticket;
      });
      expect(await joinRoom(code, { user: c })).toEqual({ ok: false, error: "started" });

      const waiting = await view(tickets[0]);
      expect(waiting).toMatchObject({ kind: "ranked", status: "playing", question: null, ranked: { result: null } });
      expect(waiting.startsAt).toBeGreaterThan(Date.now());
      expect(waiting.settings).toMatchObject({ ...RANKED_SETTINGS, lang: "fr" });
      expect(Object.values(waiting.ranked!.ratings)).toEqual([START_RATING, START_RATING]);
      expect(await answerRoom(tickets[0], 0, "peu-importe")).toEqual({ ok: false, error: "forbidden" });
    });

    it("se joue comme un salon, puis met à jour les deux cotes une seule fois", async () => {
      const [a, b] = users;
      await elapse(code, 7000);
      const first = await view(tickets[0]);
      expect(first).toMatchObject({ startsAt: null, question: { index: 0, total: RANKED_SETTINGS.questionCount, reveal: null } });

      const room = await db().room.findUniqueOrThrow({ where: { code } });
      const [question] = generateMixed(room.seed, MIX_SLUGS, RANKED_SETTINGS.questionCount, RANKED_SETTINGS.difficulty, anime);
      const wrong = question.options.find((option) => option.id !== question.answerId)!.id;
      expect(await answerRoom(tickets[0], 0, question.answerId)).toEqual({ ok: true });
      expect(await answerRoom(tickets[1], 0, wrong)).toEqual({ ok: true });

      // Plus personne ne répond : chaque question expire, puis sa correction
      for (let step = 0; step < 30 && (await view(tickets[0])).status === "playing"; step++) await elapse(code, 11_000);
      const won = await view(tickets[0]);
      const lost = await view(tickets[1]);
      expect(won).toMatchObject({ status: "finished", ranked: { result: { outcome: "win", delta: 16, rating: 1016 } } });
      expect(lost).toMatchObject({ status: "finished", ranked: { result: { outcome: "loss", delta: -16, rating: 984 } } });
      // Les cotes de départ restent affichées
      expect(Object.values(won.ranked!.ratings)).toEqual([START_RATING, START_RATING]);
      expect(await restartRoom(tickets[0])).toEqual({ ok: false, error: "forbidden" });

      // Plusieurs lectures du salon n'ont compté qu'un duel
      await view(tickets[0]);
      const accounts = await db().user.findMany({ where: { id: { in: [a.id, b.id] } }, orderBy: { rating: "desc" } });
      expect(accounts).toMatchObject([
        { id: a.id, rating: 1016, rankedGames: 1, rankedWins: 1, rankedSeason: season },
        { id: b.id, rating: 984, rankedGames: 1, rankedWins: 0, rankedSeason: season },
      ]);
      expect(await db().rankedMatch.count({ where: { roomId: room.id } })).toBe(1);
      // Le duel rapporte aussi des Berrys, comme un salon à deux
      expect(won.reward!.berrys).toBeGreaterThan(300);
    });

    it("montre au joueur sa cote, son rang et ses derniers duels", async () => {
      const [a, b, c] = users;
      const overview = await rankedOverview(a);
      expect(overview).toMatchObject({ season, profile: { season, rating: 1016, games: 1, wins: 1 }, recap: null });
      expect(overview.yourRank).toBeGreaterThanOrEqual(1);
      expect(overview.leaderboard.find((row) => row.you)).toMatchObject({ username: a.username, rating: 1016, look: {} });
      expect(overview.history).toMatchObject([{ opponent: b.username, outcome: "win", delta: 16 }]);
      expect((await rankedOverview(b)).history).toMatchObject([{ opponent: a.username, outcome: "loss", delta: -16 }]);
      // Qui n'a pas joué n'est pas classé
      expect(await rankedOverview(c)).toMatchObject({ yourRank: null, history: [], profile: { rating: START_RATING, games: 0 } });
    });

    it("ne réunit plus deux joueurs qui se sont trop affrontés dans la journée", async () => {
      const [a, b] = users;
      const duel = { season, playerAId: a.id, playerBId: b.id, nameA: a.username, nameB: b.username, scoreA: 0, scoreB: 0, ratingA: 1000, ratingB: 1000, deltaA: 0, deltaB: 0 };
      await db().rankedMatch.createMany({
        data: Array.from({ length: MAX_PAIR_DUELS_PER_DAY - 1 }, (_, i) => ({ ...duel, roomId: `test-${stamp}-${i}` })),
      });
      expect(await joinQueue(a, "fr")).toMatchObject({ status: "searching" });
      expect(await joinQueue(b, "fr")).toMatchObject({ status: "searching" });
      expect(await pollQueue(a.id)).toMatchObject({ status: "searching" });
      await leaveQueue(a.id);
      await leaveQueue(b.id);
      await db().rankedMatch.deleteMany({ where: { roomId: { startsWith: `test-${stamp}-` } } });
    });

    it("solde un duel que les deux joueurs ont quitté avant la fin", async () => {
      const [a, b] = users;
      await joinQueue(a, "fr");
      const found = await joinQueue(b, "fr");
      if (found.status !== "matched") throw new Error("pas d'adversaire");
      roomCodes.push(found.code);
      // Personne ne vient : dix minutes plus tard, le salon n'a pas bougé
      await db().room.update({ where: { code: found.code }, data: { createdAt: new Date(Date.now() - 600_000) } });
      await finishStaleDuels(a.id);
      const room = await db().room.findUniqueOrThrow({ where: { code: found.code } });
      expect(room).toMatchObject({ status: "finished" });
      expect(room.settledAt).not.toBeNull();
      // Égalité à zéro : le mieux coté des deux y perd un peu
      expect(await db().user.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ rating: 1015, rankedGames: 2, rankedWins: 1 });
      expect(await db().user.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ rating: 985, rankedGames: 2 });
      // Le joueur n'est plus ramené à ce duel
      expect(await joinQueue(a, "fr")).toMatchObject({ status: "searching" });
      await leaveQueue(a.id);
    });

    it("verse la prime de la saison passée au retour du joueur", async () => {
      const [, , c] = users;
      await db().user.update({ where: { id: c.id }, data: { rating: 1450, rankedSeason: "2020-01", rankedGames: 9, rankedWins: 6 } });
      const overview = await rankedOverview(c);
      expect(overview.recap).toEqual({ season: "2020-01", rating: 1450, games: 9, wins: 6, berrys: 10_000, cosmetic: "title-nouveau-monde" });
      expect(overview.profile).toEqual({ season, rating: 1225, games: 0, wins: 0 });
      const state = await loadState(c.id);
      expect(state).toMatchObject({ berrys: 10_000, lifetimeBerrys: 10_000, cosmetics: { owned: ["title-nouveau-monde"], equipped: {} } });
      // Une seule fois
      expect((await rankedOverview(c)).recap).toBeNull();
      expect((await loadState(c.id)).berrys).toBe(10_000);
      expect(await db().rankedSeasonResult.findMany({ where: { userId: c.id } })).toMatchObject([{ season: "2020-01", berrys: 10_000 }]);
    });
  });

  describe("raid", () => {
    const answersOf = async (attackId: string) => {
      const attack = await db().raidAttack.findUniqueOrThrow({ where: { id: attackId } });
      return generateMixed(attack.seed, MIX_SLUGS, RAID_QUESTIONS, "normal", anime).map((question) => question.answerId);
    };

    it("ouvre le raid de la semaine à la première visite", async () => {
      const raid = await raidView(null, raidDay);
      expect(raid).toMatchObject({ week: raidWeek, boss: raidBoss(raidWeek), damage: 0, defeated: false, participants: 0, you: null, loot: [] });
      expect(raid.hp).toBeGreaterThanOrEqual(40_000);
      expect((await raidView(users[0].id, raidDay)).you).toEqual({ damage: 0, attacks: 0, rank: null, attacksLeft: RAID_ATTACKS_PER_DAY });
    });

    it("envoie les questions sans leurs réponses, puis compte les dégâts de l'assaut", async () => {
      const [a] = users;
      const started = await startRaidAttack(a.id, "anime", "fr", raidDay);
      if (!started.ok) throw new Error(started.error);
      expect(started.questions).toHaveLength(RAID_QUESTIONS);
      expect(JSON.stringify(started)).not.toContain("answerId");
      expect(JSON.stringify(started)).not.toContain("seed");

      const answers = await answersOf(started.attackId);
      expect(await finishRaidAttack(users[1].id, started.attackId, answers)).toEqual({ ok: false, error: "not-found" });
      const before = await loadState(a.id);
      // Huit bonnes réponses, une fausse, une question sans réponse
      const result = await finishRaidAttack(a.id, started.attackId, [...answers.slice(0, 8), "mauvaise-réponse", null]);
      if (!result.ok) throw new Error(result.error);
      expect(result).toMatchObject({ correct: 8, damage: 800, crewBonus: 0, berrys: 160, finisher: false });
      expect(result.answers.map((answer) => answer.answerId)).toEqual(answers);
      expect(result.state.berrys).toBe(before.berrys + 160);
      // Un second envoi ne frappe pas deux fois
      expect(await finishRaidAttack(a.id, started.attackId, answers)).toEqual({ ok: false, error: "not-found" });

      const raid = await raidView(a.id, raidDay);
      expect(raid).toMatchObject({ damage: 800, participants: 1, you: { damage: 800, attacks: 1, rank: 1, attacksLeft: RAID_ATTACKS_PER_DAY - 1 } });
      expect(raid.leaderboard).toMatchObject([{ rank: 1, username: a.username, damage: 800, you: true }]);
    });

    it("refuse un assaut rendu trop tard, et limite les assauts du jour", async () => {
      const [a] = users;
      const late = await startRaidAttack(a.id, "anime", "fr", raidDay);
      if (!late.ok) throw new Error(late.error);
      await db().raidAttack.update({ where: { id: late.attackId }, data: { startedAt: new Date(Date.now() - 3_600_000) } });
      expect(await finishRaidAttack(a.id, late.attackId, await answersOf(late.attackId))).toEqual({ ok: false, error: "expired" });

      expect((await startRaidAttack(a.id, "anime", "fr", raidDay)).ok).toBe(true);
      // Trois assauts lancés, terminés ou non
      expect(await startRaidAttack(a.id, "anime", "fr", raidDay)).toEqual({ ok: false, error: "limit" });
      expect((await raidView(a.id, raidDay)).you).toMatchObject({ damage: 800, attacksLeft: 0 });
    });

    it("donne le butin une fois l'adversaire vaincu, doré pour le podium", async () => {
      const [a, b, c] = users;
      expect(await claimRaidLoot(a.id, raidWeek)).toEqual({ ok: false, error: "not-found" });

      // L'adversaire n'a presque plus de points de vie : le prochain assaut l'achève
      await db().raid.update({ where: { week: raidWeek }, data: { hp: 1000 } });
      const last = await startRaidAttack(b.id, "anime", "fr", raidDay);
      if (!last.ok) throw new Error(last.error);
      const blow = await finishRaidAttack(b.id, last.attackId, (await answersOf(last.attackId)).slice(0, 3));
      expect(blow).toMatchObject({ ok: true, correct: 3, damage: 300, finisher: true });
      expect(await startRaidAttack(c.id, "anime", "fr", raidDay)).toEqual({ ok: false, error: "defeated" });

      const raid = await raidView(a.id, raidDay);
      expect(raid).toMatchObject({ defeated: true, damage: 1000, hp: 1000 });
      expect(raid.loot).toEqual([{ week: raidWeek, bossId: raid.boss.id, rank: 1, golden: true, berrys: RAID_LOOT.berrys }]);
      expect(await pendingCounts(a.id, false)).toMatchObject({ loot: 1 });
      // Trois bonnes réponses ne suffisent pas pour prétendre au butin ; ne pas avoir combattu non plus
      expect(await claimRaidLoot(b.id, raidWeek)).toEqual({ ok: false, error: "not-eligible" });
      expect(await claimRaidLoot(c.id, raidWeek)).toEqual({ ok: false, error: "not-found" });

      const before = await loadState(a.id);
      const loot = await claimRaidLoot(a.id, raidWeek);
      if (!loot.ok) throw new Error(loot.error);
      expect(loot).toMatchObject({ berrys: RAID_LOOT.berrys, characterId: raid.boss.id, golden: true, cosmetic: RAID_LOOT.cosmetic });
      expect(loot.state.berrys).toBe(before.berrys + RAID_LOOT.berrys);
      expect(loot.state.collection[raid.boss.id]).toEqual({ count: 1, golden: 1 });
      expect(loot.state.cosmetics.owned).toContain(RAID_LOOT.cosmetic);
      expect(await claimRaidLoot(a.id, raidWeek)).toEqual({ ok: false, error: "not-found" });
      expect(await pendingCounts(a.id, false)).toMatchObject({ loot: 0 });
    });
  });

  describe("marché", () => {
    const filters: MarketFilters = { mode: "anime", lang: "fr", tier: null, query: "", sort: "recent", missingOnly: false };
    const rare = anime.characters.find((c) => c.tier === 2)!;
    const common = anime.characters.find((c) => c.tier === 4)!;
    const mine = async (userId: string) => (await marketOverview(userId, { ...filters, query: rare.name })).listings.filter((l) => l.characterId === rare.id);

    beforeAll(async () => {
      const [a, b] = users;
      await db().collectionEntry.deleteMany({ where: { userId: { in: [a.id, b.id] } } });
      await db().collectionEntry.createMany({
        data: [
          { userId: a.id, characterId: rare.id, count: 3, golden: 1 },
          { userId: a.id, characterId: common.id, count: 1, golden: 0 },
        ],
      });
      await db().user.update({ where: { id: a.id }, data: { berrys: 0, lifetimeBerrys: 0 } });
      await db().user.update({ where: { id: b.id }, data: { berrys: 5000, lifetimeBerrys: 5000 } });
    });

    it("met en vente un exemplaire en trop, à un prix de la fourchette", async () => {
      const [a] = users;
      expect(await createListing(a.id, "personnage-invente", false, 1000)).toEqual({ ok: false, error: "unknown-character" });
      expect(await createListing(a.id, rare.id, false, 50)).toEqual({ ok: false, error: "bad-price" });
      expect(await createListing(a.id, rare.id, false, 999_990)).toEqual({ ok: false, error: "bad-price" });
      // Le seul exemplaire d'un avis ne se vend pas
      expect(await createListing(a.id, common.id, false, 500)).toEqual({ ok: false, error: "not-sellable" });

      const listed = await createListing(a.id, rare.id, false, 2000);
      if (!listed.ok) throw new Error(listed.error);
      // L'exemplaire quitte la collection tant que l'annonce est ouverte
      expect(listed.state.collection[rare.id]).toEqual({ count: 2, golden: 1 });
      const golden = await createListing(a.id, rare.id, true, 6000);
      expect(golden.ok && golden.state.collection[rare.id]).toEqual({ count: 1, golden: 0 });
      expect(await createListing(a.id, rare.id, false, 2000)).toEqual({ ok: false, error: "not-sellable" });
    });

    it("montre les annonces selon les filtres, sans révéler un personnage du manga à qui suit l'anime", async () => {
      const [a, b] = users;
      const seen = await mine(b.id);
      expect(seen).toMatchObject([
        { golden: true, price: 6000, seller: a.username, mine: false },
        { golden: false, price: 2000, seller: a.username, mine: false },
      ]);
      expect((await mine(a.id)).every((listing) => listing.mine)).toBe(true);
      expect((await marketOverview(a.id, filters)).mine).toMatchObject({ active: [{ price: 6000 }, { price: 2000 }], sales: [] });
      expect((await marketOverview(null, filters)).mine).toBeNull();

      const cheap = (await marketOverview(b.id, { ...filters, query: rare.name, sort: "cheap" })).listings;
      expect(cheap.filter((l) => l.characterId === rare.id).map((l) => l.price)).toEqual([2000, 6000]);
      expect((await marketOverview(b.id, { ...filters, query: rare.name, tier: 4 })).listings.filter((l) => l.characterId === rare.id)).toEqual([]);
      expect((await marketOverview(b.id, { ...filters, query: "zzzz introuvable" })).listings).toEqual([]);

      // Un personnage que l'anime n'a pas encore montré : son annonce n'apparaît qu'en mode manga
      const manga = resolveGameData(buildGameData(), "manga");
      const spoiler = manga.characters.find((c) => !anime.characterById.has(c.id))!;
      const listing = await db().marketListing.create({ data: { sellerId: a.id, characterId: spoiler.id, price: 1000 } });
      const ids = async (mode: "anime" | "manga") => (await marketOverview(b.id, { ...filters, mode, query: spoiler.name })).listings.map((l) => l.id);
      expect(await ids("manga")).toContain(listing.id);
      expect(await ids("anime")).not.toContain(listing.id);
      await db().marketListing.delete({ where: { id: listing.id } });
    });

    it("vend l'annonce au premier acheteur, taxe retenue", async () => {
      const [a, b, c] = users;
      const [golden, plain] = await mine(b.id);
      expect(await buyListing(a.id, plain.id)).toEqual({ ok: false, error: "own-listing" });
      expect(await buyListing(b.id, "annonce-inconnue")).toEqual({ ok: false, error: "not-found" });
      // Pas assez de Berrys : l'annonce reste ouverte
      expect(await buyListing(b.id, golden.id)).toEqual({ ok: false, error: "insufficient" });
      expect(await mine(b.id)).toHaveLength(2);

      const bought = await buyListing(b.id, plain.id);
      if (!bought.ok) throw new Error(bought.error);
      expect(bought.state.berrys).toBe(3000);
      expect(bought.state.collection[rare.id]).toEqual({ count: 1, golden: 0 });
      expect(await buyListing(c.id, plain.id)).toEqual({ ok: false, error: "gone" });

      // Le vendeur touche le prix moins la taxe, sans que sa prime bouge
      expect(await loadState(a.id)).toMatchObject({ berrys: 1800, lifetimeBerrys: 0 });
      expect(await pendingCounts(a.id, false)).toMatchObject({ sales: 1 });
      const sales = (await marketOverview(a.id, filters)).mine!.sales;
      expect(sales).toMatchObject([{ characterId: rare.id, price: 2000, proceeds: 1800, buyer: b.username, fresh: true }]);
      await acknowledgeSales(a.id);
      expect(await pendingCounts(a.id, false)).toMatchObject({ sales: 0 });
      expect((await marketOverview(a.id, filters)).mine!.sales[0].fresh).toBe(false);
    });

    it("rend l'exemplaire au vendeur qui retire son annonce", async () => {
      const [a, b] = users;
      const [golden] = await mine(b.id);
      expect(await cancelListing(b.id, golden.id)).toEqual({ ok: false, error: "not-found" });
      const cancelled = await cancelListing(a.id, golden.id);
      expect(cancelled.ok && cancelled.state.collection[rare.id]).toEqual({ count: 2, golden: 1 });
      expect(await cancelListing(a.id, golden.id)).toEqual({ ok: false, error: "gone" });
      expect(await buyListing(b.id, golden.id)).toEqual({ ok: false, error: "gone" });
      expect(await mine(b.id)).toEqual([]);
    });

    it("limite le nombre d'annonces ouvertes par vendeur", async () => {
      const [a] = users;
      await db().collectionEntry.update({ where: { userId_characterId: { userId: a.id, characterId: common.id } }, data: { count: MARKET_MAX_LISTINGS + 5 } });
      for (let i = 0; i < MARKET_MAX_LISTINGS; i++) expect((await createListing(a.id, common.id, false, 300)).ok).toBe(true);
      expect(await createListing(a.id, common.id, false, 300)).toEqual({ ok: false, error: "limit" });
      expect((await loadState(a.id)).collection[common.id].count).toBe(5);
    });
  });

  describe("cosmétiques d'un compte", () => {
    it("débite l'achat, porte le cosmétique et le laisse retirer", async () => {
      const [, b] = users;
      await db().user.update({ where: { id: b.id }, data: { berrys: 3500 } });
      const bought = await buyCosmeticFor(b.id, "flag-azur");
      if (!bought.ok) throw new Error(bought.reason);
      expect(bought.state).toMatchObject({ berrys: 500, cosmetics: { owned: ["flag-azur"], equipped: { flag: "flag-azur" } } });
      expect(await buyCosmeticFor(b.id, "flag-azur")).toEqual({ ok: false, reason: "owned" });
      expect(await buyCosmeticFor(b.id, "flag-rouge")).toEqual({ ok: false, reason: "insufficient" });
      expect(await buyCosmeticFor(b.id, "title-fleau")).toEqual({ ok: false, reason: "locked" });

      const bare = await equipCosmeticFor(b.id, "flag", null);
      expect(bare.ok && bare.state.cosmetics).toEqual({ owned: ["flag-azur"], equipped: {} });
      expect(await equipCosmeticFor(b.id, "flag", "flag-or")).toEqual({ ok: false, reason: "not-owned" });
      const worn = await equipCosmeticFor(b.id, "flag", "flag-azur");
      expect(worn.ok && (await loadState(b.id)).cosmetics.equipped).toEqual({ flag: "flag-azur" });
    });
  });
});
