"use client";

/**
 * État du joueur (Berrys, collection, équipage) pour toute l'interface.
 * Invité : l'état vit dans le navigateur et les règles s'appliquent sur place.
 * Connecté : le serveur fait foi ; chaque action lui est envoyée et il renvoie
 * l'état à jour.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { resolveGameData } from "@/games/cards";
import { dailyKey } from "@/games/engine/daily";
import { createRng, randomSeed } from "@/games/engine/rng";
import { evaluateReport, type GameReport } from "@/games/report";
import { loadGameData } from "@/games/ui/data";
import { useStored } from "@/games/ui/storage";
import {
  applyGame,
  applyCrew,
  assignPost,
  deleteCrew,
  saveCrew,
  limitGuestGame,
  EMPTY_PLAYER,
  equipCosmetic,
  normalizePlayer,
  sellDuplicates,
  type PlayerState,
} from "@/lib/economy";
import { useLocale } from "@/lib/i18n/client";
import type { SpoilerMode } from "@/lib/spoilers";
import {
  buyBoosterAction,
  buyCosmeticAction,
  buyRecruitAction,
  equipCosmeticAction,
  sellDuplicatesAction,
  saveCrewAction,
  savedCrewAction,
  setCrewAction,
  submitGameAction,
} from "./actions";
import type { BoosterResult, CosmeticResult, CrewResult, GameResult, MeResponse, RecruitResult, SellResult } from "./types";

type PlayerContext = {
  /** `loading` tant qu'on ne sait pas si le visiteur est connecté. */
  status: "loading" | "guest" | "user";
  accountsEnabled: boolean;
  username: string | null;
  /** Le joueur connecté administre le site : il voit le lien vers `/admin`. */
  isAdmin: boolean;
  state: PlayerState;
  reportGame: (report: GameReport) => Promise<GameResult>;
  recruit: (mode: SpoilerMode) => Promise<RecruitResult>;
  /** Achète un booster : plusieurs avis d'un coup. */
  booster: (mode: SpoilerMode) => Promise<BoosterResult>;
  assign: (post: string, characterId: string | null) => Promise<CrewResult>;
  /** Garde de côté l'équipage en place, sous ce nom ; un nom déjà pris remplace l'enregistrement. */
  saveCrewAs: (name: string) => Promise<CrewResult>;
  /** Remet en place un équipage enregistré, ou le supprime (`remove`). */
  switchCrew: (crewId: string, remove?: boolean) => Promise<CrewResult>;
  /** Défait les doublons d'un avis, ou de tous les avis visibles dans ce mode (`characterId` nul). */
  sell: (mode: SpoilerMode, characterId: string | null) => Promise<SellResult>;
  /** Achète un cosmétique à la boutique : il est porté aussitôt. */
  buyLook: (cosmeticId: string) => Promise<CosmeticResult>;
  /** Porte un cosmétique possédé, ou revient à l'apparence d'origine (`cosmeticId` nul). */
  wear: (slot: string, cosmeticId: string | null) => Promise<CosmeticResult>;
  /** État du joueur connecté renvoyé par une action faite ailleurs (marché, raid). */
  sync: (state: PlayerState) => void;
  /** Relit l'état du joueur connecté, après un gain obtenu ailleurs que dans un jeu (salon multijoueur). */
  refresh: () => void;
};

const Context = createContext<PlayerContext | null>(null);

export function usePlayer(): PlayerContext {
  const context = useContext(Context);
  if (!context) throw new Error("usePlayer doit être utilisé sous <PlayerProvider>");
  return context;
}

/** Parties d'invité déjà récompensées (clé jeu + tirage), pour ne pas payer deux fois la même. */
const REWARDED_KEY = "opm.player.rewarded";
const NO_KEYS: string[] = [];

export function PlayerProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [storedGuest, setGuest] = useStored<PlayerState>("opm.player", EMPTY_PLAYER);
  // Une progression enregistrée par une version précédente du site peut ne pas avoir tous les champs
  const guest = useMemo(() => normalizePlayer(storedGuest), [storedGuest]);
  const [rewarded, setRewarded] = useStored<string[]>(REWARDED_KEY, NO_KEYS);
  const [remote, setRemote] = useState<PlayerState | null>(null);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((response) => (response.ok ? (response.json() as Promise<MeResponse>) : null))
      .catch(() => null)
      .then((data) => {
        if (cancelled) return;
        setMe(data ?? { accountsEnabled: false, user: null, state: null });
        if (data?.state) setRemote(data.state);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const isUser = !!me?.user;
  const state = isUser ? (remote ?? EMPTY_PLAYER) : guest;

  const reportGame = useCallback(
    async (report: GameReport): Promise<GameResult> => {
      if (isUser) {
        const result = await submitGameAction(report, locale).catch(() => ({ ok: false, reason: "unavailable" }) as const);
        if (result.ok) setRemote(result.state);
        return result;
      }
      const key = `${report.slug}:${"seed" in report ? report.seed : report.day}`;
      if (rewarded.includes(key)) return { ok: false, reason: "duplicate" };

      const raw = await loadGameData(locale);
      const data = resolveGameData(raw, report.mode);
      const outcome = evaluateReport(report, {
        data,
        animeCharacters: resolveGameData(raw, "anime").characters,
        today: dailyKey(),
      });
      if (!outcome) return { ok: false, reason: "invalid" };

      const applied = applyGame(guest, outcome, data.characters, dailyKey(), createRng(randomSeed()));
      // Sans compte : Berrys plafonnés, pas de prime, recrue scellée (voir src/lib/economy/guest.ts)
      const limited = limitGuestGame(guest, applied.state, applied.reward);
      setGuest(limited.state);
      setRewarded([...rewarded.slice(-200), key]);
      return { ok: true, state: limited.state, outcome, reward: limited.reward };
    },
    [isUser, guest, rewarded, setGuest, setRewarded, locale],
  );

  const recruit = useCallback(
    async (mode: SpoilerMode): Promise<RecruitResult> => {
      if (isUser) {
        const result = await buyRecruitAction(mode).catch(() => ({ ok: false, reason: "unavailable" }) as const);
        if (result.ok) setRemote(result.state);
        return result;
      }
      // Les achats demandent un compte : un solde d'invité vit dans le navigateur, où tout peut s'écrire
      return { ok: false, reason: "account" };
    },
    [isUser],
  );

  const booster = useCallback(
    async (mode: SpoilerMode): Promise<BoosterResult> => {
      if (isUser) {
        const result = await buyBoosterAction(mode).catch(() => ({ ok: false, reason: "unavailable" }) as const);
        if (result.ok) setRemote(result.state);
        return result;
      }
      return { ok: false, reason: "account" };
    },
    [isUser],
  );

  const assign = useCallback(
    async (post: string, characterId: string | null): Promise<CrewResult> => {
      if (isUser) {
        const result = await setCrewAction(post, characterId).catch(() => ({ ok: false, reason: "unavailable" }) as const);
        if (result.ok) setRemote(result.state);
        return result;
      }
      const next = assignPost(guest, post, characterId);
      if (typeof next === "string") return { ok: false, reason: next };
      setGuest(next);
      return { ok: true, state: next };
    },
    [isUser, guest, setGuest],
  );

  const saveCrewAs = useCallback(
    async (name: string): Promise<CrewResult> => {
      if (isUser) {
        const result = await saveCrewAction(name).catch(() => ({ ok: false, reason: "unavailable" }) as const);
        if (result.ok) setRemote(result.state);
        return result;
      }
      const next = saveCrew(guest, name, crypto.randomUUID());
      if (typeof next === "string") return { ok: false, reason: next };
      setGuest(next);
      return { ok: true, state: next };
    },
    [isUser, guest, setGuest],
  );

  const switchCrew = useCallback(
    async (crewId: string, remove = false): Promise<CrewResult> => {
      if (isUser) {
        const result = await savedCrewAction(crewId, remove).catch(() => ({ ok: false, reason: "unavailable" }) as const);
        if (result.ok) setRemote(result.state);
        return result;
      }
      const next = remove ? deleteCrew(guest, crewId) : applyCrew(guest, crewId);
      if (typeof next === "string") return { ok: false, reason: next };
      setGuest(next);
      return { ok: true, state: next };
    },
    [isUser, guest, setGuest],
  );

  const sell = useCallback(
    async (mode: SpoilerMode, characterId: string | null): Promise<SellResult> => {
      if (isUser) {
        const result = await sellDuplicatesAction(mode, characterId).catch(() => ({ ok: false, reason: "unavailable" }) as const);
        if (result.ok) setRemote(result.state);
        return result;
      }
      const data = resolveGameData(await loadGameData(locale), mode);
      const sale = sellDuplicates(guest, data.characterById, characterId);
      if (typeof sale === "string") return { ok: false, reason: sale };
      setGuest(sale.state);
      return { ok: true, state: sale.state, berrys: sale.berrys, sold: sale.sold };
    },
    [isUser, guest, setGuest, locale],
  );

  const buyLook = useCallback(
    async (cosmeticId: string): Promise<CosmeticResult> => {
      if (isUser) {
        const result = await buyCosmeticAction(cosmeticId).catch(() => ({ ok: false, reason: "unavailable" }) as const);
        if (result.ok) setRemote(result.state);
        return result;
      }
      return { ok: false, reason: "account" };
    },
    [isUser],
  );

  const wear = useCallback(
    async (slot: string, cosmeticId: string | null): Promise<CosmeticResult> => {
      if (isUser) {
        const result = await equipCosmeticAction(slot, cosmeticId).catch(() => ({ ok: false, reason: "unavailable" }) as const);
        if (result.ok) setRemote(result.state);
        return result;
      }
      const next = equipCosmetic(guest, slot, cosmeticId);
      if (typeof next === "string") return { ok: false, reason: next };
      setGuest(next);
      return { ok: true, state: next };
    },
    [isUser, guest, setGuest],
  );

  const value = useMemo<PlayerContext>(
    () => ({
      status: me === null ? "loading" : isUser ? "user" : "guest",
      accountsEnabled: me?.accountsEnabled ?? false,
      username: me?.user?.username ?? null,
      isAdmin: me?.user?.admin ?? false,
      state,
      reportGame,
      recruit,
      booster,
      assign,
      saveCrewAs,
      switchCrew,
      sell,
      buyLook,
      wear,
      sync: setRemote,
      refresh,
    }),
    [me, isUser, state, reportGame, recruit, booster, assign, saveCrewAs, switchCrew, sell, buyLook, wear, refresh],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
