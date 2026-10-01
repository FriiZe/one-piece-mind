"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/client";
import { notificationsChanged } from "@/lib/multi/client";
import { subscribePushAction, unsubscribePushAction } from "./push-actions";

/**
 * Où en sont les notifications push sur cet appareil :
 * - `off` : possibles, pas activées ;
 * - `on` : activées ;
 * - `denied` : bloquées dans les réglages du navigateur ;
 * - `install` : iPhone ou iPad, où il faut d'abord ajouter le site à l'écran d'accueil ;
 * - `null` : rien à proposer (navigateur sans notifications, site sans clés VAPID, état pas encore connu).
 */
export type PushState = "off" | "on" | "denied" | "install" | null;

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const WORKER = "/sw.js";

/** La clé publique, écrite en base64 « URL », telle que l'attend le navigateur. */
function keyBytes(): Uint8Array<ArrayBuffer> {
  const base64 = PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(PUBLIC_KEY.length / 4) * 4, "=");
  return Uint8Array.from(window.atob(base64), (char) => char.charCodeAt(0));
}

function sameKey(subscription: PushSubscription): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current);
  const expected = keyBytes();
  return bytes.length === expected.length && bytes.every((byte, index) => byte === expected[index]);
}

/** Sur iPhone et iPad, les notifications n'existent que pour un site ajouté à l'écran d'accueil. */
function needsInstall(): boolean {
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return apple && !window.matchMedia("(display-mode: standalone)").matches;
}

/** Abonnement déjà pris par ce navigateur avec la clé du site, s'il y en a un. */
async function existingSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(WORKER);
  const subscription = (await registration?.pushManager.getSubscription()) ?? null;
  if (subscription && !sameKey(subscription)) {
    // Abonnement pris avec une ancienne clé : le serveur ne peut plus s'en servir
    await subscription.unsubscribe();
    return null;
  }
  return subscription;
}

/**
 * Notifications push de cet appareil, pour le joueur connecté. `enable` demande
 * l'autorisation au navigateur : à n'appeler que sur un clic du joueur.
 */
export function usePush(enabled: boolean): { state: PushState; busy: boolean; enable: () => void; disable: () => void } {
  const locale = useLocale();
  const [state, setState] = useState<PushState>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled || !PUBLIC_KEY) return;
    let cancelled = false;
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    async function read(): Promise<PushState> {
      if (!supported) return needsInstall() ? "install" : null;
      if (Notification.permission === "denied") return "denied";
      const subscription = Notification.permission === "granted" ? await existingSubscription() : null;
      if (!subscription) return "off";
      // À chaque visite, l'abonnement est rattaché à la session en cours et à la langue du site
      const saved = await subscribePushAction(subscription.toJSON(), locale);
      return saved.ok ? "on" : "off";
    }
    read()
      .catch((): PushState => null)
      .then((next) => {
        if (!cancelled) setState(next);
      });

    // Le service worker signale chaque notification reçue : la cloche se met à jour aussitôt
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "opm:notifications") notificationsChanged();
    };
    if (supported) navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      if (supported) navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [enabled, locale]);

  const run = useCallback((task: () => Promise<PushState>) => {
    setBusy(true);
    task()
      .catch((): PushState => "off")
      .then((next) => {
        setState(next);
        setBusy(false);
      });
  }, []);

  const enable = useCallback(
    () =>
      run(async () => {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return permission === "denied" ? "denied" : "off";
        const registration = await navigator.serviceWorker.register(WORKER, { updateViaCache: "none" });
        await navigator.serviceWorker.ready;
        const subscription =
          (await existingSubscription()) ??
          (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes() }));
        const saved = await subscribePushAction(subscription.toJSON(), locale);
        if (saved.ok) return "on";
        await subscription.unsubscribe();
        return "off";
      }),
    [run, locale],
  );

  const disable = useCallback(
    () =>
      run(async () => {
        await (await existingSubscription())?.unsubscribe();
        await unsubscribePushAction();
        return "off";
      }),
    [run],
  );

  return { state: enabled ? state : null, busy, enable, disable };
}
