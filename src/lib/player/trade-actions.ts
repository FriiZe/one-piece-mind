"use server";

/** Actions sur les échanges entre amis. Chacune vérifie la session : elles peuvent être appelées directement. */
import type { TradeLine, TradeResult } from "@/lib/multi/trades";
import { currentUser } from "@/lib/server/session";
import { answerTrade, cancelTrade, proposeTrade } from "@/lib/server/trades";

const UNAVAILABLE: TradeResult = { ok: false, error: "unavailable" };
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 80;

/** Les deux listes d'avis sont revérifiées côté serveur : leur forme comme leur taille. */
export async function proposeTradeAction(friendId: string, offered: TradeLine[], requested: TradeLine[]): Promise<TradeResult> {
  const user = await currentUser();
  if (!user || !isId(friendId)) return UNAVAILABLE;
  return proposeTrade(user.id, friendId, offered, requested);
}

export async function answerTradeAction(tradeId: string, accept: boolean): Promise<TradeResult> {
  const user = await currentUser();
  if (!user || !isId(tradeId)) return UNAVAILABLE;
  return answerTrade(user.id, tradeId, accept === true);
}

export async function cancelTradeAction(tradeId: string): Promise<TradeResult> {
  const user = await currentUser();
  if (!user || !isId(tradeId)) return UNAVAILABLE;
  return cancelTrade(user.id, tradeId);
}
