"use client";

/**
 * État conservé dans le navigateur (mode spoiler, records, défi du jour).
 * `useStored` se lit comme un `useState` ; la valeur survit au rechargement
 * et reste synchronisée entre les onglets.
 */
import { useCallback, useSyncExternalStore } from "react";
import { dailyKey } from "../engine/daily";
import { useLocale } from "@/lib/i18n/client";

const listeners = new Set<() => void>();
const parsed = new Map<string, { raw: string | null; value: unknown }>();
/** Repli quand le stockage du navigateur est indisponible (navigation privée stricte). */
const memory = new Map<string, string>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function read<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  const cached = parsed.get(key);
  if (cached && cached.raw === raw) return cached.value as T;

  let value = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  parsed.set(key, { raw, value });
  return value;
}

/** Lecture ponctuelle, hors rendu : dans un gestionnaire d'événement, par exemple. */
export function readStored<T>(key: string, fallback: T): T {
  return read(key, fallback);
}

export function writeStored<T>(key: string, value: T): void {
  const raw = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    memory.set(key, raw);
  }
  listeners.forEach((listener) => listener());
}

/** `fallback` doit être une valeur stable (primitive ou constante de module). */
export function useStored<T>(key: string, fallback: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );
  const set = useCallback((next: T) => writeStored(key, next), [key]);
  return [value, set];
}

const noop = () => () => {};

/** Faux pendant le rendu serveur et l'hydratation, vrai ensuite. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

function subscribeToClock(listener: () => void): () => void {
  const timer = window.setInterval(listener, 30_000);
  return () => window.clearInterval(timer);
}

/** Date du jour à Paris, mise à jour au passage de minuit. */
export function useDailyKey(): string {
  return useSyncExternalStore(subscribeToClock, dailyKey, dailyKey);
}

const parisClock = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Minutes restantes avant minuit à Paris. */
function minutesUntilMidnight(): number {
  const parts = parisClock.formatToParts(new Date());
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return 24 * 60 - (read("hour") * 60 + read("minute"));
}
const noCountdown = () => null;

/**
 * Temps restant avant minuit à Paris (« 5 h 12 », « 5h 12m » en anglais), quand la sélection du jour change.
 * Nul avant que le navigateur soit prêt.
 */
export function useUntilMidnight(): string | null {
  const locale = useLocale();
  const left = useSyncExternalStore<number | null>(subscribeToClock, minutesUntilMidnight, noCountdown);
  if (left === null) return null;
  const hours = Math.floor(left / 60);
  if (hours === 0) return `${left} min`;
  const minutes = String(left % 60).padStart(2, "0");
  return locale === "en" ? `${hours}h ${minutes}m` : `${hours} h ${minutes}`;
}

/** Meilleur score d'un jeu ; `submit` ne l'écrase que s'il est battu (un score nul n'est pas un record). */
export function useBest(id: string): [number | null, (score: number) => boolean] {
  const [best, setBest] = useStored<number | null>(`opm.best.${id}`, null);
  const submit = useCallback(
    (score: number) => {
      const beaten = score > (best ?? 0);
      if (beaten) setBest(score);
      return beaten;
    },
    [best, setBest],
  );
  return [best, submit];
}
