import type { MeResponse } from "@/lib/player/types";
import { accountsEnabled } from "@/lib/server/db";
import { loadState } from "@/lib/server/player";
import { currentUser, renewSession } from "@/lib/server/session";

export async function GET() {
  const user = await currentUser();
  if (user) await renewSession();
  const body: MeResponse = {
    accountsEnabled,
    user: user ? { username: user.username } : null,
    state: user ? await loadState(user.id) : null,
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
