"use server";

/** Abonnement de ce navigateur aux notifications push. Chaque action vérifie la session. */
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import { parsePushSubscription } from "@/lib/multi/push";
import { pushEnabled, removePushSubscriptions, savePushSubscription } from "@/lib/server/push";
import { currentSessionId, currentUser } from "@/lib/server/session";

/** `subscription` : ce que donne `PushSubscription.toJSON()` dans le navigateur. `lang` : langue des notifications. */
export async function subscribePushAction(subscription: unknown, lang: Locale): Promise<{ ok: boolean }> {
  const parsed = parsePushSubscription(subscription);
  const sessionId = pushEnabled && parsed && (await currentUser()) ? await currentSessionId() : null;
  if (!parsed || !sessionId) return { ok: false };
  await savePushSubscription(sessionId, parsed, isLocale(lang) ? lang : DEFAULT_LOCALE);
  return { ok: true };
}

export async function unsubscribePushAction(): Promise<{ ok: boolean }> {
  const sessionId = pushEnabled && (await currentUser()) ? await currentSessionId() : null;
  if (!sessionId) return { ok: false };
  await removePushSubscriptions(sessionId);
  return { ok: true };
}
