import type { RoomError, RoomTicket } from "@/lib/multi/types";
import { accountsEnabled } from "@/lib/server/db";
import { answerRoom, inviteToRoom, joinRoom, restartRoom, startRoom, viewRoom } from "@/lib/server/rooms";
import { allowAttempt, clientAddress, currentUser } from "@/lib/server/session";

const STATUS: Partial<Record<RoomError, number>> = { "not-found": 404, forbidden: 403, "rate-limited": 429, unavailable: 503 };
const reply = (result: { ok: boolean; error?: RoomError }) =>
  Response.json(result, {
    status: result.ok ? 200 : (STATUS[result.error!] ?? 400),
    headers: { "Cache-Control": "no-store" },
  });

/** Le joueur s'identifie par deux en-têtes, pour que son jeton n'apparaisse dans aucune adresse. */
function ticketOf(request: Request, code: string): RoomTicket | null {
  const playerId = request.headers.get("x-room-player");
  const token = request.headers.get("x-room-token");
  return playerId && token ? { code, playerId, token } : null;
}

/** État du salon. `?v=` : version déjà connue du joueur, pour ne renvoyer que ce qui a changé. */
export async function GET(request: Request, ctx: RouteContext<"/api/rooms/[code]">) {
  if (!accountsEnabled) return reply({ ok: false, error: "unavailable" });
  const { code } = await ctx.params;
  const ticket = ticketOf(request, code);
  if (!ticket) return reply({ ok: false, error: "not-found" });
  // Sans `v`, le joueur n'a encore rien : `Number(null)` vaudrait 0, soit la version d'un salon tout neuf
  const v = new URL(request.url).searchParams.get("v");
  const known = v !== null && /^\d+$/.test(v) ? Number(v) : undefined;
  return reply(await viewRoom(ticket, known));
}

export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]">) {
  if (!accountsEnabled) return reply({ ok: false, error: "unavailable" });
  const { code } = await ctx.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return reply({ ok: false, error: "bad-request" });

  if (body.action === "join") {
    // Limite les essais de codes au hasard
    if (!(await allowAttempt(`room-join:${await clientAddress()}`, 60, 600_000))) return reply({ ok: false, error: "rate-limited" });
    return reply(
      await joinRoom(code, { user: await currentUser(), name: typeof body.name === "string" ? body.name : undefined }),
    );
  }

  const ticket = ticketOf(request, code);
  if (!ticket) return reply({ ok: false, error: "not-found" });
  switch (body.action) {
    case "start":
      return reply(await startRoom(ticket));
    case "answer":
      return reply(await answerRoom(ticket, body.questionIndex, body.optionId));
    case "restart":
      return reply(await restartRoom(ticket));
    case "invite":
      return reply(await inviteToRoom(ticket, await currentUser(), body.friendId));
    default:
      return reply({ ok: false, error: "bad-request" });
  }
}
