import type { RoomError } from "@/lib/multi/types";
import { accountsEnabled } from "@/lib/server/db";
import { createRoom } from "@/lib/server/rooms";
import { allowAttempt, clientAddress, currentUser } from "@/lib/server/session";

const fail = (error: RoomError, status: number) => Response.json({ ok: false, error }, { status });

/** Crée un salon. Le corps décrit ses réglages et, pour un invité, son pseudo. */
export async function POST(request: Request) {
  if (!accountsEnabled) return fail("unavailable", 503);
  const body = (await request.json().catch(() => null)) as { settings?: unknown; name?: unknown } | null;
  if (!body) return fail("bad-request", 400);
  if (!(await allowAttempt(`room-create:${await clientAddress()}`, 20, 3_600_000))) return fail("rate-limited", 429);

  const result = await createRoom(body.settings, {
    user: await currentUser(),
    name: typeof body.name === "string" ? body.name : undefined,
  });
  return Response.json(result, { status: result.ok ? 201 : 400 });
}
