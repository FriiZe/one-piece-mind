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
import { applyGame, assignPost, buyRecruit, EMPTY_PLAYER, normalizePlayer, sellDuplicates, type PlayerState } from "@/lib/economy";
import type { SpoilerMode } from "@/lib/spoilers";
import { buyRecruitAction, sellDuplicatesAction, setCrewAction, submitGameAction } from "./actions";
import type { CrewResult, GameResult, MeResponse, RecruitResult, SellResult } from "./types";

type PlayerContext = {
  /** `loading` tant qu'on ne sait pas si le visiteur est connecté. */
  status: "loading" | "guest" | "user";
  accountsEnabled: boolean;
  username: string | null;
  state: PlayerState;
  reportGame: (report: GameReport) => Promise<GameResult>;
  recruit: (mode: SpoilerMode) => Promise<RecruitResult>;
  assign: (post: string, characterId: string | null) => Promise<CrewResult>;
  /** Défait les doublons d'un avis, ou de tous les avis visibles dans ce mode (`characterId` nul). */
  sell: (mode: SpoilerMode, characterId: string | null) => Promise<SellResult>;
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
        const result = await submitGameAction(report).catch(() => ({ ok: false, reason: "unavailable" }) as const);
        if (result.ok) setRemote(result.state);
        return result;
      }
      const key = `${report.slug}:${"seed" in report ? report.seed : report.day}`;
      if (rewarded.includes(key)) return { ok: false, reason: "duplicate" };

      const raw = await loadGameData();
      const data = resolveGameData(raw, report.mode);
      const outcome = evaluateReport(report, {
        data,
        animeCharacters: resolveGameData(raw, "anime").characters,
        today: dailyKey(),
      });
      if (!outcome) return { ok: false, reason: "invalid" };

      const applied = applyGame(guest, outcome, data.characters, dailyKey(), createRng(randomSeed()));
      setGuest(applied.state);
      setRewarded([...rewarded.slice(-200), key]);
      return { ok: true, state: applied.state, outcome, reward: applied.reward };
    },
    [isUser, guest, rewarded, setGuest, setRewarded],
  );

  const recruit = useCallback(
    async (mode: SpoilerMode): Promise<RecruitResult> => {
      if (isUser) {
        const result = await buyRecruitAction(mode).catch(() => ({ ok: false, reason: "unavailable" }) as const);
        if (result.ok) setRemote(result.state);
        return result;
      }
      const data = resolveGameData(await loadGameData(), mode);
      const bought = buyRecruit(guest, data.characters, createRng(randomSeed()));
      if (typeof bought === "string") return { ok: false, reason: bought };
      setGuest(bought.state);
      return { ok: true, ...bought };
    },
    [isUser, guest, setGuest],
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

  const sell = useCallback(
    async (mode: SpoilerMode, characterId: string | null): Promise<SellResult> => {
      if (isUser) {
        const result = await sellDuplicatesAction(mode, characterId).catch(() => ({ ok: false, reason: "unavailable" }) as const);
        if (result.ok) setRemote(result.state);
        return result;
      }
      const data = resolveGameData(await loadGameData(), mode);
      const sale = sellDuplicates(guest, data.characterById, characterId);
      if (typeof sale === "string") return { ok: false, reason: sale };
      setGuest(sale.state);
      return { ok: true, state: sale.state, berrys: sale.berrys, sold: sale.sold };
    },
    [isUser, guest, setGuest],
  );

  const value = useMemo<PlayerContext>(
    () => ({
      status: me === null ? "loading" : isUser ? "user" : "guest",
      accountsEnabled: me?.accountsEnabled ?? false,
      username: me?.user?.username ?? null,
      state,
      reportGame,
      recruit,
      assign,
      sell,
      refresh,
    }),
    [me, isUser, state, reportGame, recruit, assign, sell, refresh],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
