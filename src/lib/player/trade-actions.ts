"use server";

/** Actions sur les échanges entre amis. Chacune vérifie la session : elles peuvent être appelées directement. */
import type { TradeResult } from "@/lib/multi/trades";
import { currentUser } from "@/lib/server/session";
import { answerTrade, cancelTrade, proposeTrade } from "@/lib/server/trades";

const UNAVAILABLE: TradeResult = { ok: false, error: "unavailable" };
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 80;

export async function proposeTradeAction(friendId: string, offeredId: string, requestedId: string): Promise<TradeResult> {
  const user = await currentUser();
  if (!user || !isId(friendId) || !isId(offeredId) || !isId(requestedId)) return UNAVAILABLE;
  return proposeTrade(user.id, friendId, offeredId, requestedId);
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
