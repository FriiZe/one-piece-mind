import "server-only";
import { normalizeText } from "@/games/engine/text";
import type { Locale } from "@/lib/i18n";
import {
  isValidPrice,
  MARKET_MAX_LISTINGS,
  MARKET_PAGE_SIZE,
  marketProceeds,
  type MarketSort,
} from "@/lib/market/rules";
import type { ListingView, MarketOverview, MarketResult } from "@/lib/market/types";
import type { SpoilerMode } from "@/lib/spoilers";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { exchangeAccessFor } from "./exchange";
import { gameData, loadState, type Tx } from "./player";
import { notifyFrom } from "./push";

const SALES_SHOWN = 10;

export type MarketFilters = {
  mode: SpoilerMode;
  lang: Locale;
  /** Rareté voulue (1 = légendaire), ou toutes. */
  tier: number | null;
  /** Début ou morceau du nom d'un personnage. */
  query: string;
  sort: MarketSort;
  /** Seulement les avis que le joueur n'a pas encore. */
  missingOnly: boolean;
};

const ORDER: Record<MarketSort, Prisma.MarketListingOrderByWithRelationInput[]> = {
  recent: [{ createdAt: "desc" }],
  cheap: [{ price: "asc" }, { createdAt: "asc" }],
  expensive: [{ price: "desc" }, { createdAt: "asc" }],
};

type ListingRow = Prisma.MarketListingGetPayload<{ include: { seller: { select: { username: true } } } }>;
const toView = (row: ListingRow, userId: string | null): ListingView => ({
  id: row.id,
  characterId: row.characterId,
  golden: row.golden,
  price: row.price,
  seller: row.seller.username,
  mine: row.sellerId === userId,
  createdAt: row.createdAt.getTime(),
});

/**
 * Annonces ouvertes, filtrées. Le filtre se fait ici, sur les personnages que
 * le mode spoiler du joueur lui montre : une annonce ne révèle jamais un
 * personnage qu'il n'a pas encore vu.
 */
export async function marketOverview(userId: string | null, filters: MarketFilters): Promise<MarketOverview> {
  const data = gameData(filters.mode, filters.lang);
  const wanted = normalizeText(filters.query);
  const visible = data.characters
    .filter((character) => filters.tier === null || character.tier === filters.tier)
    .filter(
      (character) =>
        !wanted || [character.name, character.altName ?? "", ...character.aliases].some((name) => normalizeText(name).includes(wanted)),
    )
    .map((character) => character.id);
  const owned =
    userId && filters.missingOnly
      ? (await db().collectionEntry.findMany({ where: { userId }, select: { characterId: true } })).map((entry) => entry.characterId)
      : [];
  const hidden = new Set(owned);
  const where = { status: "active", characterId: { in: visible.filter((id) => !hidden.has(id)) } } satisfies Prisma.MarketListingWhereInput;

  const [rows, total, active, sales, access] = await Promise.all([
    db().marketListing.findMany({ where, orderBy: ORDER[filters.sort], take: MARKET_PAGE_SIZE, include: { seller: { select: { username: true } } } }),
    db().marketListing.count({ where }),
    userId
      ? db().marketListing.findMany({
          where: { sellerId: userId, status: "active" },
          orderBy: { createdAt: "desc" },
          include: { seller: { select: { username: true } } },
        })
      : [],
    userId
      ? db().marketListing.findMany({
          where: { sellerId: userId, status: "sold" },
          orderBy: { soldAt: "desc" },
          take: SALES_SHOWN,
          include: { buyer: { select: { username: true } } },
        })
      : [],
    userId ? exchangeAccessFor(userId) : null,
  ]);

  return {
    listings: rows.map((row) => toView(row, userId)),
    total,
    access,
    mine: userId
      ? {
          active: active.map((row) => toView(row, userId)),
          sales: sales.map((sale) => ({
            id: sale.id,
            characterId: sale.characterId,
            golden: sale.golden,
            price: sale.price,
            proceeds: sale.proceeds,
            buyer: sale.buyer?.username ?? null,
            soldAt: (sale.soldAt ?? sale.createdAt).getTime(),
            fresh: sale.seenAt === null,
          })),
        }
      : null,
  };
}

/** Ventes conclues que le vendeur n'a pas encore vues, pour la cloche de l'en-tête. */
export function unseenSales(userId: string): Promise<number> {
  return db().marketListing.count({ where: { sellerId: userId, status: "sold", seenAt: null } });
}

/** Le vendeur a vu ses ventes : la cloche ne les compte plus. */
export async function acknowledgeSales(userId: string): Promise<void> {
  await db().marketListing.updateMany({ where: { sellerId: userId, status: "sold", seenAt: null }, data: { seenAt: new Date() } });
}

class Refused extends Error {
  constructor(readonly reason: "not-sellable" | "gone" | "insufficient") {
    super(reason);
  }
}

/** Retire de la collection l'exemplaire mis en vente, ordinaire ou doré. Le joueur doit en garder au moins un. */
async function takeForSale(tx: Tx, userId: string, characterId: string, golden: boolean) {
  const entry = await tx.collectionEntry.findUnique({ where: { userId_characterId: { userId, characterId } } });
  if (!entry || entry.count < 2 || (golden ? entry.golden < 1 : entry.count - entry.golden < 1)) throw new Refused("not-sellable");
  // L'avis doit être resté tel qu'on l'a lu : deux mises en vente simultanées ne vendent pas deux fois le même exemplaire
  const updated = await tx.collectionEntry.updateMany({
    where: { userId, characterId, count: entry.count, golden: entry.golden },
    data: { count: { decrement: 1 }, golden: { decrement: golden ? 1 : 0 } },
  });
  if (updated.count === 0) throw new Refused("not-sellable");
}

async function giveCopy(tx: Tx, userId: string, characterId: string, golden: boolean) {
  await tx.collectionEntry.upsert({
    where: { userId_characterId: { userId, characterId } },
    create: { userId, characterId, count: 1, golden: golden ? 1 : 0 },
    update: { count: { increment: 1 }, golden: { increment: golden ? 1 : 0 } },
  });
}

/** Met en vente un exemplaire en trop : il quitte la collection du vendeur tant que l'annonce est ouverte. */
export async function createListing(userId: string, characterId: string, golden: boolean, price: unknown): Promise<MarketResult> {
  if (!(await exchangeAccessFor(userId)).open) return { ok: false, error: "locked" };
  const character = gameData("manga").characterById.get(characterId);
  if (!character) return { ok: false, error: "unknown-character" };
  if (!isValidPrice(price, character.tier, golden)) return { ok: false, error: "bad-price" };

  try {
    return await db().$transaction(async (tx) => {
      const open = await tx.marketListing.count({ where: { sellerId: userId, status: "active" } });
      if (open >= MARKET_MAX_LISTINGS) return { ok: false, error: "limit" } as const;
      await takeForSale(tx, userId, characterId, golden);
      await tx.marketListing.create({ data: { sellerId: userId, characterId, golden, price } });
      return { ok: true, state: await loadState(userId, tx) } as const;
    });
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: "not-sellable" };
    throw error;
  }
}

/** Retire une annonce : l'exemplaire revient dans la collection du vendeur. */
export async function cancelListing(userId: string, listingId: string): Promise<MarketResult> {
  return db().$transaction(async (tx) => {
    const listing = await tx.marketListing.findFirst({ where: { id: listingId, sellerId: userId } });
    if (!listing) return { ok: false, error: "not-found" } as const;
    const cancelled = await tx.marketListing.updateMany({ where: { id: listing.id, status: "active" }, data: { status: "cancelled" } });
    if (cancelled.count === 0) return { ok: false, error: "gone" } as const;
    await giveCopy(tx, userId, listing.characterId, listing.golden);
    return { ok: true, state: await loadState(userId, tx) } as const;
  });
}

/**
 * Achète une annonce. L'annonce se ferme, l'acheteur paie, le vendeur touche
 * le prix moins la taxe et l'exemplaire change de collection, d'un seul
 * tenant. Les Berrys d'une vente ne comptent ni dans la prime du vendeur ni
 * dans son plafond du jour : ils ont déjà été gagnés une fois. Le vendeur
 * est prévenu par une notification push, s'il les a activées.
 */
export async function buyListing(userId: string, listingId: string): Promise<MarketResult> {
  const listing = await db().marketListing.findUnique({ where: { id: listingId } });
  if (!listing) return { ok: false, error: "not-found" };
  if (listing.sellerId === userId) return { ok: false, error: "own-listing" };
  // Acheter aussi fait passer des Berrys d'un compte à l'autre : même garde-fou que pour vendre
  if (!(await exchangeAccessFor(userId)).open) return { ok: false, error: "locked" };

  const proceeds = marketProceeds(listing.price);
  let result: MarketResult;
  try {
    result = await db().$transaction(async (tx) => {
      // Le statut sert de verrou : deux acheteurs simultanés n'emportent pas la même annonce
      const sold = await tx.marketListing.updateMany({
        where: { id: listing.id, status: "active" },
        data: { status: "sold", buyerId: userId, soldAt: new Date(), proceeds },
      });
      if (sold.count === 0) throw new Refused("gone");
      const paid = await tx.user.updateMany({
        where: { id: userId, berrys: { gte: listing.price } },
        data: { berrys: { decrement: listing.price } },
      });
      // L'erreur annule la transaction : l'annonce redevient disponible
      if (paid.count === 0) throw new Refused("insufficient");
      await tx.user.update({ where: { id: listing.sellerId }, data: { berrys: { increment: proceeds } } });
      await giveCopy(tx, userId, listing.characterId, listing.golden);
      return { ok: true, state: await loadState(userId, tx) } as const;
    });
  } catch (error) {
    if (error instanceof Refused && error.reason !== "not-sellable") return { ok: false, error: error.reason };
    throw error;
  }

  // Le vendeur est prévenu sur ses appareils ; le nom du personnage y figure dans la langue de chacun
  const nameIn = (locale: Locale) => gameData("manga", locale).characterById.get(listing.characterId)?.name ?? listing.characterId;
  await notifyFrom(listing.sellerId, userId, (from) => ({
    type: "market-sold",
    from,
    listingId: listing.id,
    character: { fr: nameIn("fr"), en: nameIn("en") },
    golden: listing.golden,
    proceeds,
  }));
  return result;
}
