import "server-only";
import webpush from "web-push";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import { pushMessage, type PushEvent, type PushSubscriptionInput } from "@/lib/multi/push";
import { SITE_URL } from "@/lib/site";
import { accountsEnabled, db } from "./db";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
/** Contact donné aux services de notification : une adresse `https:` ou `mailto:`. */
const subject = process.env.VAPID_SUBJECT || (SITE_URL.startsWith("https:") ? SITE_URL : "mailto:admin@example.com");

/** Sans clés VAPID, le site fonctionne sans notifications push : la cloche reste seule. */
export const pushEnabled = accountsEnabled && !!publicKey && !!privateKey;

/** Durée pendant laquelle un service de notification garde un message pour un appareil éteint. */
const DAY_SECONDS = 86_400;
/** Une invitation dans un salon ne vaut que deux heures (src/lib/server/friends.ts). */
const INVITE_SECONDS = 2 * 3600;
/** Au-delà, on renonce : l'action du joueur n'attend pas un service de notification en panne. */
const SEND_TIMEOUT_MS = 3000;

/**
 * Enregistre l'abonnement du navigateur de cette session. Un navigateur n'a
 * qu'un abonnement : l'ancien, s'il a changé, est retiré.
 */
export async function savePushSubscription(sessionId: string, subscription: PushSubscriptionInput, lang: Locale): Promise<void> {
  const { endpoint, keys } = subscription;
  await db().$transaction([
    db().pushSubscription.deleteMany({ where: { sessionId, endpoint: { not: endpoint } } }),
    db().pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, sessionId, lang, ...keys },
      // Un autre joueur s'est connecté sur ce navigateur : l'abonnement le suit
      update: { sessionId, lang, ...keys },
    }),
  ]);
}

export async function removePushSubscriptions(sessionId: string): Promise<void> {
  await db().pushSubscription.deleteMany({ where: { sessionId } });
}

/**
 * Envoie un message aux appareils où le joueur a activé les notifications et où
 * sa session est encore ouverte. `event` n'est appelé que s'il y en a.
 */
async function deliver(userId: string, event: () => Promise<PushEvent | null>): Promise<void> {
  if (!pushEnabled) return;
  try {
    const subscriptions = await db().pushSubscription.findMany({
      where: { session: { userId, expiresAt: { gt: new Date() } } },
    });
    const sent = subscriptions.length > 0 ? await event() : null;
    if (!sent) return;

    const gone: string[] = [];
    await Promise.all(
      subscriptions.map(async ({ endpoint, p256dh, auth, lang }) => {
        const message = pushMessage(sent, isLocale(lang) ? lang : DEFAULT_LOCALE);
        try {
          await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, JSON.stringify(message), {
            vapidDetails: { subject, publicKey, privateKey },
            TTL: sent.type === "room-invite" ? INVITE_SECONDS : DAY_SECONDS,
            timeout: SEND_TIMEOUT_MS,
          });
        } catch (error) {
          // 404 ou 410 : le navigateur a résilié cet abonnement, il ne servira plus
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(endpoint);
          else console.error("Notification push refusée", status ?? error);
        }
      }),
    );
    if (gone.length > 0) await db().pushSubscription.deleteMany({ where: { endpoint: { in: gone } } });
  } catch (error) {
    console.error("Notification push non envoyée", error);
  }
}

/**
 * Prévient un joueur. Ne lève jamais d'erreur : une notification perdue ne doit
 * pas faire échouer l'action qui l'a déclenchée.
 */
export async function notify(userId: string, event: PushEvent): Promise<void> {
  await deliver(userId, async () => event);
}

/** Prévient un joueur de ce que vient de faire `fromId`, dont le pseudo figure dans le message. */
export async function notifyFrom(userId: string, fromId: string, event: (from: string) => PushEvent): Promise<void> {
  await deliver(userId, async () => {
    const from = await db().user.findUnique({ where: { id: fromId }, select: { username: true } });
    return from ? event(from.username) : null;
  });
}
