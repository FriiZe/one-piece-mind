import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dailyKey } from "@/games/engine/daily";
import { adminOverview, adminUser, adminUsers } from "@/lib/server/admin";
import { accountsEnabled, db } from "@/lib/server/db";
import { DUMMY_HASH } from "@/lib/server/password";

// Ces tests écrivent dans la base locale (docker compose up -d) ; ils sont ignorés sans DATABASE_URL.
describe.skipIf(!accountsEnabled)("administration, en base", () => {
  const stamp = Date.now() % 1_000_000;
  const users: { id: string; username: string }[] = [];
  const today = dailyKey();
  let adminsBefore: string | undefined;

  beforeAll(async () => {
    for (const name of ["suivi_admin", "suivi_actif", "suivi_ancien"]) {
      const username = `${name}_${stamp}`;
      users.push(await db().user.create({ data: { username, usernameKey: username, passwordHash: DUMMY_HASH }, select: { id: true, username: true } }));
    }
    adminsBefore = process.env.ADMIN_USERNAMES;
    process.env.ADMIN_USERNAMES = users[0].username;

    const [, active, old] = users;
    await db().user.update({
      where: { id: active.id },
      data: { lastSeenAt: new Date(), games: 2, lifetimeBerrys: 2_000_000_000, stats: { wordle: { games: 2, best: 1 } }, dayKey: today, dayEarned: 70 },
    });
    await db().gameResult.createMany({
      data: [
        { userId: active.id, slug: "onepiecedle-daily", reportKey: `daily:${today}`, mode: "anime", score: 1, maxScore: 1, berrys: 50 },
        { userId: active.id, slug: "wordle", reportKey: "1234", mode: "manga", difficulty: "moyen", score: 3, maxScore: 5, berrys: 20 },
      ],
    });
    await db().collectionEntry.create({ data: { userId: active.id, characterId: "nami", count: 3, golden: 1 } });
    // Inscrit et vu il y a longtemps : hors de toutes les périodes
    const longAgo = new Date(Date.now() - 400 * 86_400_000);
    await db().user.update({ where: { id: old.id }, data: { createdAt: longAgo, lastSeenAt: longAgo } });
  });
  afterAll(async () => {
    await db().user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    process.env.ADMIN_USERNAMES = adminsBefore;
    await db().$disconnect();
  });

  it("ne répond qu'aux administrateurs", async () => {
    const [, player] = users;
    expect(await adminOverview(null, 7)).toBeNull();
    expect(await adminOverview(player, 7)).toBeNull();
    expect(await adminUsers(player, {})).toBeNull();
    expect(await adminUser(player, player.id)).toBeNull();
    expect(await adminUsers(null, {})).toBeNull();
  });

  it("compte les inscriptions, les parties et les joueurs actifs jour par jour", async () => {
    const [admin] = users;
    const overview = (await adminOverview(admin, 7))!;
    expect(overview.days).toHaveLength(7);
    expect(overview.days.at(-1)!.day).toBe(today);
    // La base locale peut contenir d'autres comptes : on vérifie des minimums
    const last = overview.days.at(-1)!;
    expect(last.signups).toBeGreaterThanOrEqual(2);
    expect(last.games).toBeGreaterThanOrEqual(2);
    expect(last.players).toBeGreaterThanOrEqual(1);
    expect(overview.players).toBeGreaterThanOrEqual(1);
    expect(overview.accounts).toBeGreaterThanOrEqual(3);
    expect(overview.seen24h).toBeGreaterThanOrEqual(1);
    expect(overview.seen7d).toBeGreaterThanOrEqual(overview.seen24h);
    expect(overview.topGames.find((game) => game.slug === "wordle")!.games).toBeGreaterThanOrEqual(1);
    expect(overview.latest.length).toBeGreaterThan(0);

    // Sur 90 jours : plus de jours, au moins autant d'inscriptions
    const wide = (await adminOverview(admin, 90))!;
    const total = (days: { signups: number }[]) => days.reduce((sum, day) => sum + day.signups, 0);
    expect(wide.days).toHaveLength(90);
    expect(total(wide.days)).toBeGreaterThanOrEqual(total(overview.days));
  });

  it("cherche, trie et pagine les joueurs", async () => {
    const [admin, active, old] = users;
    const found = (await adminUsers(admin, { query: `  SUIVI_ACTIF_${stamp} ` }))!;
    expect(found.total).toBe(1);
    expect(found.rows[0]).toMatchObject({ id: active.id, games: 2, cards: 1 });

    const mine = (await adminUsers(admin, { query: `_${stamp}`, sort: "seen" }))!;
    // Vu à l'instant, puis vu il y a longtemps, puis jamais vu
    expect(mine.rows.map((row) => row.id)).toEqual([active.id, old.id, admin.id]);
    expect((await adminUsers(admin, { query: `_${stamp}`, sort: "bounty" }))!.rows[0].id).toBe(active.id);

    // Une page hors limites ramène à la dernière
    expect((await adminUsers(admin, { query: `_${stamp}`, page: 99 }))!).toMatchObject({ page: 1, pages: 1 });
    expect((await adminUsers(admin, { query: "aucun pseudo ne ressemble à ça" }))!).toMatchObject({ total: 0, rows: [] });
  });

  it("détaille la fiche d'un joueur", async () => {
    const [admin, active] = users;
    const detail = (await adminUser(admin, active.id))!;
    expect(detail).toMatchObject({ username: active.username, cards: 1, copies: 3, golden: 1, earnedToday: 70, sessions: 0, lastLogin: null });
    expect(detail.perGame).toEqual([{ slug: "wordle", games: 2, best: 1 }]);
    expect(detail.recentGames.map((game) => game.slug).sort()).toEqual(["onepiecedle-daily", "wordle"]);
    expect(await adminUser(admin, "identifiant-inconnu")).toBeNull();
  });
});
