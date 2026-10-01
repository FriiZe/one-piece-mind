"use server";

/** Actions du marché. Chacune vérifie la session : elles peuvent être appelées directement. */
import type { MarketResult } from "@/lib/market/types";
import { acknowledgeSales, buyListing, cancelListing, createListing } from "@/lib/server/market";
import { allowAttempt, currentUser } from "@/lib/server/session";

const UNAVAILABLE: MarketResult = { ok: false, error: "unavailable" };
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 80;

export async function createListingAction(characterId: string, golden: boolean, price: number): Promise<MarketResult> {
  const user = await currentUser();
  if (!user || !isId(characterId)) return UNAVAILABLE;
  // Une annonce se retire et se remet : on borne le nombre de mises en vente par heure
  if (!(await allowAttempt(`market-list:${user.id}`, 60, 3_600_000))) return { ok: false, error: "limit" };
  return createListing(user.id, characterId, golden === true, price);
}

export async function cancelListingAction(listingId: string): Promise<MarketResult> {
  const user = await currentUser();
  if (!user || !isId(listingId)) return UNAVAILABLE;
  return cancelListing(user.id, listingId);
}

export async function buyListingAction(listingId: string): Promise<MarketResult> {
  const user = await currentUser();
  if (!user || !isId(listingId)) return UNAVAILABLE;
  return buyListing(user.id, listingId);
}

/** Le vendeur a vu ses ventes : elles ne sont plus comptées par la cloche. */
export async function acknowledgeSalesAction(): Promise<void> {
  const user = await currentUser();
  if (user) await acknowledgeSales(user.id);
}
