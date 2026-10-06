"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PlayerTag, useCosmeticName } from "@/components/Cosmetics";
import Link from "@/components/Link";
import { formatNumber } from "@/games/engine/text";
import { Button, Panel } from "@/games/ui/primitives";
import { LoadingPanel } from "@/games/ui/WithGameData";
import { useLocale, useLocalePath, useT } from "@/lib/i18n/client";
import { roomAction, saveTicket, useNow } from "@/lib/multi/client";
import type { RoomTicket } from "@/lib/multi/types";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { joinRankedQueueAction, leaveRankedQueueAction } from "@/lib/player/ranked-actions";
import { useRankedOverview } from "@/lib/ranked/client";
import { leagueOf, LEAGUES, QUEUE_POLL_MS, RANKED_SETTINGS, SEASON_MIN_GAMES } from "@/lib/ranked/rules";
import { RANKED_ERRORS, type QueueStatus, type RankedOverview } from "@/lib/ranked/types";

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

/** La cote du joueur, sa ligue et ce qui le sépare de la suivante. */
function Standing({ overview }: { overview: RankedOverview }) {
  const t = useT();
  const locale = useLocale();
  const { profile, yourRank, daysLeft } = overview;
  const { league, next, progress } = leagueOf(profile.rating);
  const missing = Math.max(0, SEASON_MIN_GAMES - profile.games);

  return (
    <section aria-label={t("Ma cote", "My rating")} className="rounded-xl border-4 border-parchment-dark bg-parchment p-6 text-ink">
      <p className="text-xs font-extrabold tracking-[0.25em] uppercase">
        {t("Ligue", "League")} · {t(`saison ${overview.season}`, `season ${overview.season}`)}
      </p>
      <p className="font-display text-5xl leading-none tracking-wide">{league.title[locale]}</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-display text-4xl tracking-wide">{formatNumber(profile.rating, locale)}</span>
        <span className="font-bold">
          {t(
            `${profile.wins} victoire${profile.wins > 1 ? "s" : ""} sur ${profile.games} duel${profile.games > 1 ? "s" : ""}`,
            `${profile.wins} ${profile.wins === 1 ? "win" : "wins"} in ${profile.games} ${profile.games === 1 ? "duel" : "duels"}`,
          )}
          {yourRank !== null && ` · ${t(`${yourRank}${yourRank === 1 ? "er" : "e"} de la saison`, `#${yourRank} this season`)}`}
        </span>
      </p>

      <div className="mt-4 space-y-1.5">
        <p className="flex justify-between gap-3 text-sm font-bold">
          <span>{league.title[locale]}</span>
          <span>
            {next
              ? t(`${next.title.fr} à ${formatNumber(next.from, "fr")}`, `${next.title.en} at ${formatNumber(next.from, "en")}`)
              : t("Ligue la plus haute", "Highest league")}
          </span>
        </p>
        <div
          role="progressbar"
          aria-label={t("Progression vers la ligue suivante", "Progress toward the next league")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-2.5 overflow-hidden rounded-full bg-parchment-dark"
        >
          <div className="h-full bg-ink" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <p className="mt-4 text-sm">
        {t(
          `La saison se termine dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}. Ta ligue te vaudra alors ${formatNumber(league.berrys, "fr")} ฿`,
          `The season ends in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}. Your league will then earn you ${formatNumber(league.berrys, "en")} ฿`,
        )}
        {missing > 0
          ? t(
              `, à condition d'avoir joué ${SEASON_MIN_GAMES} duels : encore ${missing}.`,
              `, provided you've played ${SEASON_MIN_GAMES} duels: ${missing} to go.`,
            )
          : "."}
      </p>
    </section>
  );
}

/** Recherche d'un adversaire : le bouton, puis l'attente, puis l'entrée dans le salon du duel. */
function Matchmaking() {
  const t = useT();
  const locale = useLocale();
  const path = useLocalePath();
  const router = useRouter();
  const [queue, setQueue] = useState<QueueStatus>({ status: "idle" });
  const [startedAt, setStartedAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searching = queue.status === "searching";
  const now = useNow(searching, 1000);
  // Lu au démontage : quitter la page pendant la recherche fait sortir de la file
  const status = useRef(queue.status);
  useEffect(() => {
    status.current = queue.status;
  }, [queue.status]);

  async function search() {
    setBusy(true);
    setError(null);
    const result = await joinRankedQueueAction(locale).catch(() => ({ ok: false, error: "unavailable" }) as const);
    setBusy(false);
    if (!result.ok) {
      setError(RANKED_ERRORS[locale][result.error]);
      return;
    }
    setStartedAt(Date.now());
    setQueue(result);
  }

  async function cancel() {
    setQueue({ status: "idle" });
    await leaveRankedQueueAction().catch(() => undefined);
  }

  useEffect(() => {
    if (!searching) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      const next = await fetch("/api/ranked/queue", { cache: "no-store" })
        .then((response) => (response.ok ? (response.json() as Promise<QueueStatus>) : null))
        .catch(() => null);
      // Une relecture manquée n'arrête pas la recherche : la suivante la reprend
      if (!cancelled && next) setQueue(next);
    }, QUEUE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [searching]);

  // Adversaire trouvé : le joueur prend sa place dans le salon, puis y est conduit
  const code = queue.status === "matched" ? queue.code : null;
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    void roomAction<{ ticket: RoomTicket }>(code, null, "join").then((joined) => {
      if (cancelled) return;
      if (joined.ok) saveTicket(joined.ticket);
      router.push(path(`/multi/${code}`));
    });
    return () => {
      cancelled = true;
    };
  }, [code, router, path]);

  useEffect(
    () => () => {
      if (status.current === "searching") void leaveRankedQueueAction().catch(() => undefined);
    },
    [],
  );

  const waited = searching && now > 0 ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;

  return (
    <section aria-label={t("Lancer un duel", "Start a duel")} className="space-y-4 rounded-[20px] border-2 border-straw bg-straw/5 p-5 sm:p-6">
      <h2 className="text-xl font-extrabold text-foam">Davy Back Fight</h2>
      <p className="text-mist">
        {t(
          `Un duel à un contre un : ${RANKED_SETTINGS.questionCount} questions, ${RANKED_SETTINGS.seconds} secondes chacune, les mêmes pour les deux. Le vainqueur prend des points de cote au vaincu, davantage s'il était moins bien classé. Les questions s'arrêtent à l'anime : aucun spoiler du manga.`,
          `A one-on-one duel: ${RANKED_SETTINGS.questionCount} questions, ${RANKED_SETTINGS.seconds} seconds each, the same for both players. The winner takes rating points from the loser, more so if they were ranked lower. Questions stop at the anime: no manga spoilers.`,
        )}
      </p>

      {queue.status === "idle" && (
        <Button onClick={search} disabled={busy} className="min-h-[52px] px-7 text-[17px]">
          {busy ? t("Entrée dans la file…", "Joining the queue…") : t("Chercher un adversaire", "Find an opponent")}
        </Button>
      )}
      {queue.status === "searching" && (
        <div className="flex flex-wrap items-center gap-4" role="status">
          <span className="size-5 animate-spin rounded-full border-[3px] border-straw border-t-transparent" aria-hidden="true" />
          <span className="font-extrabold text-foam">
            {t("Recherche d'un adversaire…", "Looking for an opponent…")}{" "}
            <span className="font-normal text-mist">
              {Math.floor(waited / 60)}:{String(waited % 60).padStart(2, "0")}
            </span>
          </span>
          <Button variant="secondary" onClick={cancel}>
            {t("Annuler", "Cancel")}
          </Button>
          <p className="w-full text-sm text-mist">
            {t(
              "Reste sur cette page : plus l'attente dure, plus l'écart de cote accepté s'élargit.",
              "Stay on this page: the longer you wait, the wider the accepted rating gap gets.",
            )}
          </p>
        </div>
      )}
      {queue.status === "matched" && (
        <p className="font-extrabold text-foam" role="status">
          {t("Adversaire trouvé ! Entrée dans le duel…", "Opponent found! Entering the duel…")}
        </p>
      )}
      {error && (
        <p role="alert" className="font-semibold text-vest">
          {error}
        </p>
      )}
    </section>
  );
}

function Recap({ overview }: { overview: RankedOverview }) {
  const t = useT();
  const locale = useLocale();
  const cosmeticName = useCosmeticName();
  const { recap } = overview;
  // Le serveur a soldé la saison en renvoyant ce bilan : le solde affiché dans l'en-tête doit suivre
  const { refresh } = usePlayer();
  useEffect(() => {
    if (recap) refresh();
  }, [recap, refresh]);
  if (!recap) return null;

  const league = leagueOf(recap.rating).league.title[locale];
  const title = cosmeticName(recap.cosmetic);
  return (
    <div role="status" className="rounded-2xl border border-straw/50 bg-straw/5 px-5 py-4">
      <p className="font-extrabold text-foam">
        {t(`Saison ${recap.season} terminée en ligue ${league}`, `Season ${recap.season} finished in the ${league} league`)}
      </p>
      <p className="text-mist">
        {recap.berrys > 0
          ? t(
              `Ta prime de saison : ${formatNumber(recap.berrys, "fr")} ฿${title ? `, et le titre « ${title} »` : ""}.`,
              `Your season reward: ${formatNumber(recap.berrys, "en")} ฿${title ? `, and the title “${title}”` : ""}.`,
            )
          : t(
              `Il fallait ${SEASON_MIN_GAMES} duels pour toucher la prime de saison.`,
              `It took ${SEASON_MIN_GAMES} duels to earn the season reward.`,
            )}{" "}
        {t("Ta cote repart à mi-chemin de la cote de départ.", "Your rating restarts halfway back to the starting rating.")}
      </p>
    </div>
  );
}

function History({ overview }: { overview: RankedOverview }) {
  const t = useT();
  const locale = useLocale();
  if (overview.history.length === 0) return null;
  const labels = { win: t("Victoire", "Win"), loss: t("Défaite", "Loss"), draw: t("Égalité", "Draw") };
  const tones = { win: "text-emerald-300", loss: "text-vest", draw: "text-mist" };
  return (
    <section aria-labelledby="duels" className="space-y-3">
      <h2 id="duels" className="text-xl font-extrabold text-foam">
        {t("Mes derniers duels", "My latest duels")}
      </h2>
      <ul className="space-y-2">
        {overview.history.map((match) => (
          <li key={match.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-sea-700 bg-sea-800 px-4 py-3">
            <span className={`w-20 font-extrabold ${tones[match.outcome]}`}>{labels[match.outcome]}</span>
            <span className="min-w-0 flex-1 truncate text-foam">
              {t("contre", "vs")} <strong>{match.opponent}</strong>
            </span>
            <span className="text-sm text-mist">
              {formatNumber(match.yourScore, locale)} – {formatNumber(match.theirScore, locale)}
            </span>
            <span className={`w-12 text-right font-extrabold ${match.delta > 0 ? "text-emerald-300" : match.delta < 0 ? "text-vest" : "text-mist"}`}>
              {signed(match.delta)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Leaderboard({ overview }: { overview: RankedOverview }) {
  const t = useT();
  const locale = useLocale();
  return (
    <aside aria-labelledby="classement" className="space-y-3.5 rounded-[20px] border border-sea-700 bg-sea-800 p-5">
      <h2 id="classement" className="text-lg font-extrabold text-foam">
        {t("Classement de la saison", "Season leaderboard")}
      </h2>
      {overview.leaderboard.length === 0 ? (
        <p className="text-sm text-mist">{t("Personne n'a encore joué cette saison. À toi d'ouvrir le bal.", "Nobody has played this season yet. Be the first.")}</p>
      ) : (
        <ol className="space-y-2">
          {overview.leaderboard.map((row) => (
            <li
              key={row.username}
              className={`flex min-h-14 items-center gap-3 rounded-xl border-2 bg-sea-900 px-3 py-2 ${row.you ? "border-straw" : "border-transparent"}`}
            >
              <span className={`w-6 text-center font-display text-[22px] ${row.rank === 1 ? "text-straw" : "text-mist"}`}>{row.rank}</span>
              <Link href={`/joueurs/${encodeURIComponent(row.username)}`} className="flex min-w-0 flex-1 items-center rounded-lg hover:bg-sea-800">
                <PlayerTag name={row.username} look={row.look} you={row.you} />
              </Link>
              <span className="text-right">
                <span className="block font-extrabold text-foam">{formatNumber(row.rating, locale)}</span>
                <span className="block text-xs text-mist">{leagueOf(row.rating).league.title[locale]}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <details className="text-sm text-mist">
        <summary className="cursor-pointer font-bold text-foam underline underline-offset-4">{t("Les cinq ligues", "The five leagues")}</summary>
        <ul className="mt-2 space-y-1">
          {LEAGUES.map((league) => (
            <li key={league.id} className="flex justify-between gap-3">
              <span>
                {league.title[locale]} · {t(`dès ${formatNumber(league.from, "fr")}`, `from ${formatNumber(league.from, "en")}`)}
              </span>
              <span>{formatNumber(league.berrys, locale)} ฿</span>
            </li>
          ))}
        </ul>
      </details>
    </aside>
  );
}

export function RankedHome() {
  const t = useT();
  const { status, accountsEnabled } = usePlayer();
  const { overview, failed } = useRankedOverview(status === "user");

  if (status === "loading") return <LoadingPanel />;
  if (status !== "user") {
    return (
      <Panel className="space-y-3">
        <p className="text-mist">
          {accountsEnabled
            ? t(
                "Le classé garde une cote pour chaque joueur : il se joue avec un compte.",
                "Ranked play keeps a rating for each player: you need an account to play.",
              )
            : t("Le classé n'est pas disponible sur cette version du site.", "Ranked play isn't available on this version of the site.")}
        </p>
        {accountsEnabled && (
          <Link href="/profil#compte" className="inline-block rounded-lg bg-straw px-4 py-2.5 font-bold text-ink hover:bg-straw-dark">
            {t("Se connecter ou créer un compte", "Log in or create an account")}
          </Link>
        )}
      </Panel>
    );
  }
  if (failed) {
    return (
      <Panel>
        <p className="font-semibold text-vest">{t("Le classé est indisponible pour l'instant.", "Ranked play is unavailable right now.")}</p>
      </Panel>
    );
  }
  if (!overview) return <LoadingPanel label={t("Chargement du classé…", "Loading ranked play…")} />;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <Recap overview={overview} />
        <Standing overview={overview} />
        <Matchmaking />
        <History overview={overview} />
      </div>
      <Leaderboard overview={overview} />
    </div>
  );
}
