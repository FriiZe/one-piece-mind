"use client";

/** Accès au salon depuis le navigateur : identité du joueur, appels au serveur, relecture régulière de l'état. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { FriendsOverview, NotificationCounts } from "./friends";
import type { Result, RoomError, RoomTicket, RoomView } from "./types";

const ticketKey = (code: string) => `opm.room.${code}`;

/** Ticket du joueur pour ce salon : il lui permet de retrouver sa place après un rechargement. */
export function loadTicket(code: string): RoomTicket | null {
  try {
    const raw = window.localStorage.getItem(ticketKey(code));
    const ticket = raw ? (JSON.parse(raw) as Partial<RoomTicket>) : null;
    return ticket?.playerId && ticket.token ? { code, playerId: ticket.playerId, token: ticket.token } : null;
  } catch {
    return null;
  }
}

export function saveTicket(ticket: RoomTicket): void {
  try {
    window.localStorage.setItem(ticketKey(ticket.code), JSON.stringify({ playerId: ticket.playerId, token: ticket.token }));
  } catch {
    // Sans stockage, le joueur perdra sa place en rechargeant la page : la partie reste jouable
  }
}

export function forgetTicket(code: string): void {
  try {
    window.localStorage.removeItem(ticketKey(code));
  } catch {
    // rien à oublier
  }
}

const headersOf = (ticket: RoomTicket | null): HeadersInit => ({
  "Content-Type": "application/json",
  ...(ticket ? { "x-room-player": ticket.playerId, "x-room-token": ticket.token } : {}),
});

async function parse<T>(response: Response): Promise<Result<T>> {
  const body = (await response.json().catch(() => null)) as Result<T> | null;
  return body ?? { ok: false, error: "unavailable" };
}

export async function createRoomRequest(settings: unknown, name: string | undefined): Promise<Result<{ ticket: RoomTicket }>> {
  const response = await fetch("/api/rooms", { method: "POST", headers: headersOf(null), body: JSON.stringify({ settings, name }) });
  return parse(response);
}

/** Action dans un salon : rejoindre, lancer, répondre, relancer, inviter. */
export async function roomAction<T = object>(
  code: string,
  ticket: RoomTicket | null,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<Result<T>> {
  try {
    const response = await fetch(`/api/rooms/${code}`, {
      method: "POST",
      headers: headersOf(ticket),
      body: JSON.stringify({ action, ...payload }),
    });
    return await parse<T>(response);
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

type RoomState = {
  view: RoomView | null;
  /** Écart entre l'horloge du serveur et celle du navigateur, pour un chrono juste. */
  clockOffset: number;
  error: RoomError | null;
  /** La dernière relecture a échoué : l'état affiché peut dater. */
  stale: boolean;
};

const LOBBY_INTERVAL = 2000;
const PLAYING_INTERVAL = 1000;

/**
 * État du salon, relu régulièrement auprès du serveur : toutes les secondes en
 * pleine partie, moins souvent sinon. `refresh` force une relecture immédiate
 * (après une action du joueur).
 */
export function useRoom(ticket: RoomTicket | null): RoomState & { refresh: () => void } {
  const [state, setState] = useState<RoomState>({ view: null, clockOffset: 0, error: null, stale: false });
  const version = useRef<number | null>(null);
  const status = useRef<RoomView["status"]>("lobby");
  const [kick, setKick] = useState(0);
  const refresh = useCallback(() => setKick((value) => value + 1), []);

  useEffect(() => {
    if (!ticket) return;
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const query = version.current === null ? "" : `?v=${version.current}`;
        const response = await fetch(`/api/rooms/${ticket!.code}${query}`, { headers: headersOf(ticket), cache: "no-store" });
        const result = await parse<{ view?: RoomView; unchanged?: true; serverNow?: number }>(response);
        if (cancelled) return;
        if (!result.ok) {
          // Salon disparu ou ticket refusé : inutile d'insister
          if (result.error === "not-found") {
            setState((current) => ({ ...current, error: "not-found" }));
            return;
          }
          setState((current) => ({ ...current, stale: true }));
        } else if (result.view) {
          version.current = result.view.version;
          status.current = result.view.status;
          setState({ view: result.view, clockOffset: result.view.serverNow - Date.now(), error: null, stale: false });
        } else {
          setState((current) => (current.stale ? { ...current, stale: false } : current));
        }
      } catch {
        if (!cancelled) setState((current) => ({ ...current, stale: true }));
      }
      if (!cancelled) timer = window.setTimeout(poll, status.current === "playing" ? PLAYING_INTERVAL : LOBBY_INTERVAL);
    }

    poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ticket, kick]);

  return { ...state, refresh };
}

/** Heure du navigateur, rafraîchie plusieurs fois par seconde, pour animer un chrono. */
export function useNow(active: boolean, intervalMs = 200): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  }, [active, intervalMs]);
  return now;
}

/** Amis, demandes et invitations du joueur connecté, relus de temps en temps. */
export function useFriends(enabled: boolean): { friends: FriendsOverview | null; reload: () => void } {
  const [friends, setFriends] = useState<FriendsOverview | null>(null);
  const [kick, setKick] = useState(0);
  const reload = useCallback(() => setKick((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () =>
      fetch("/api/friends", { cache: "no-store" })
        .then((response) => (response.ok ? (response.json() as Promise<FriendsOverview>) : null))
        .then((data) => {
          if (!cancelled && data) setFriends(data);
        })
        .catch(() => undefined);
    load();
    const timer = window.setInterval(load, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, kick]);

  return { friends: enabled ? friends : null, reload };
}

const NOTIFICATIONS_CHANGED = "opm:notifications";

/** À appeler après une action qui change les demandes en attente : la cloche se met à jour sans attendre. */
export function notificationsChanged(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}

/**
 * Demandes et invitations en attente du joueur connecté. Relu toutes les
 * quarante-cinq secondes tant que l'onglet est visible, et dès qu'il le redevient.
 */
export function useNotifications(enabled: boolean): NotificationCounts | null {
  const [counts, setCounts] = useState<NotificationCounts | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () =>
      fetch("/api/notifications", { cache: "no-store" })
        .then((response) => (response.ok ? (response.json() as Promise<NotificationCounts>) : null))
        .then((data) => {
          if (!cancelled && data) setCounts(data);
        })
        .catch(() => undefined);
    // Un onglet en arrière-plan n'interroge pas le serveur : il se met à jour en revenant au premier plan
    const refresh = () => {
      if (document.visibilityState === "visible") load();
    };
    load();
    const timer = window.setInterval(refresh, 45_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED, load);
    };
  }, [enabled]);

  return enabled ? counts : null;
}

export const ROOM_ERRORS: Record<RoomError, string> = {
  "not-found": "Ce salon n'existe pas, ou plus.",
  full: "Ce salon est complet.",
  "name-taken": "Ce pseudo est déjà pris dans ce salon.",
  "bad-name": "Choisis un pseudo de 2 à 16 caractères : lettres, chiffres, espaces.",
  started: "La partie a déjà commencé.",
  forbidden: "Cette action n'est pas possible maintenant.",
  "bad-request": "Réglages invalides.",
  "rate-limited": "Trop de tentatives. Réessaie dans quelques minutes.",
  unavailable: "Le multijoueur est indisponible pour l'instant.",
};
