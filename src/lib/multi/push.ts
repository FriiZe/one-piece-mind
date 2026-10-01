/** Notifications push : ce qu'on annonce à un joueur, et le texte affiché sur son appareil. Calcul pur, partagé avec les tests. */
import { localePath, type Locale, type Localized } from "@/lib/i18n";

/** Ce qui vient d'arriver à un joueur. `from` est le pseudo de celui qui en est à l'origine. */
export type PushEvent =
  | { type: "friend-request"; from: string }
  | { type: "friend-accepted"; from: string }
  | { type: "room-invite"; from: string; code: string }
  | { type: "trade-proposed"; from: string }
  | { type: "trade-accepted"; from: string }
  | { type: "trade-declined"; from: string }
  /** Pour les administrateurs : un quiz de la communauté vient d'être masqué. */
  | { type: "quiz-hidden"; title: string };

/** Ce que reçoit le service worker (public/sw.js). */
export type PushMessage = {
  title: string;
  body: string;
  /** Page ouverte au clic, dans la langue du joueur. */
  url: string;
  /** Deux notifications de même étiquette se remplacent au lieu de s'empiler. */
  tag: string;
};

const text = (locale: Locale, value: Localized) => value[locale];

export function pushMessage(event: PushEvent, locale: Locale): PushMessage {
  const message = (title: Localized, body: Localized, path: string, tag: string): PushMessage => ({
    title: text(locale, title),
    body: text(locale, body),
    url: localePath(locale, path),
    tag,
  });

  switch (event.type) {
    case "friend-request":
      return message(
        { fr: "Demande d'ami", en: "Friend request" },
        { fr: `${event.from} te demande en ami.`, en: `${event.from} sent you a friend request.` },
        "/profil#amis",
        `friend-request:${event.from}`,
      );
    case "friend-accepted":
      return message(
        { fr: "Nouvel ami", en: "New friend" },
        { fr: `${event.from} et toi êtes maintenant amis.`, en: `You and ${event.from} are now friends.` },
        "/profil#amis",
        `friend-accepted:${event.from}`,
      );
    case "room-invite":
      return message(
        { fr: "Invitation dans un salon", en: "Room invitation" },
        { fr: `${event.from} t'invite dans son salon.`, en: `${event.from} invites you to their room.` },
        `/multi/${event.code}`,
        `room-invite:${event.code}`,
      );
    case "trade-proposed":
      return message(
        { fr: "Échange proposé", en: "Trade offer" },
        { fr: `${event.from} te propose un échange d'avis de recherche.`, en: `${event.from} offers you a poster trade.` },
        "/echanges",
        `trade-proposed:${event.from}`,
      );
    case "trade-accepted":
      return message(
        { fr: "Échange accepté", en: "Trade accepted" },
        { fr: `${event.from} a accepté ton échange : l'avis est dans ta collection.`, en: `${event.from} accepted your trade: the poster is in your collection.` },
        "/collection",
        `trade-accepted:${event.from}`,
      );
    case "trade-declined":
      return message(
        { fr: "Échange refusé", en: "Trade declined" },
        { fr: `${event.from} a refusé ton échange.`, en: `${event.from} declined your trade.` },
        "/echanges",
        `trade-declined:${event.from}`,
      );
    case "quiz-hidden":
      return message(
        { fr: "Quiz masqué à relire", en: "Hidden quiz to review" },
        { fr: `« ${event.title} » a été masqué après plusieurs signalements.`, en: `"${event.title}" was hidden after several reports.` },
        "/quiz",
        "quiz-hidden",
      );
  }
}

/** Abonnement d'un navigateur, tel que le donne `PushSubscription.toJSON()`. */
export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

/**
 * Services de notification des navigateurs (Chrome et Edge, Firefox, Safari, Windows).
 * Le serveur n'écrit qu'à eux : l'adresse d'un abonnement vient du navigateur du joueur,
 * et ne doit pas pouvoir le faire appeler n'importe quelle machine.
 */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];

const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** Vérifie un abonnement envoyé par un navigateur ; `null` s'il n'est pas utilisable. */
export function parsePushSubscription(input: unknown): PushSubscriptionInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { endpoint, keys } = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null };
  if (typeof endpoint !== "string" || endpoint.length > 1000) return null;
  if (typeof keys?.p256dh !== "string" || typeof keys.auth !== "string") return null;
  if (!BASE64URL.test(keys.p256dh) || keys.p256dh.length > 200 || !BASE64URL.test(keys.auth) || keys.auth.length > 100) return null;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") return null;
  if (!PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return null;
  return { endpoint: url.href, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}
