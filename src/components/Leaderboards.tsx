"use client";

import Link from "@/components/Link";
import { useState } from "react";
import { DIFFICULTIES } from "@/games/engine/difficulty";
import { formatBounty, formatNumber } from "@/games/engine/text";
import { LoadingPanel } from "@/games/ui/WithGameData";
import { formatAgo } from "@/lib/admin/format";
import { playerBounty, rankOf } from "@/lib/economy";
import { useLocale, useT } from "@/lib/i18n/client";
import { useGameLeaderboard, useGlobalLeaderboard } from "@/lib/leaderboard/client";
import type { GameLeaderRow, GlobalLeaderRow, Period } from "@/lib/leaderboard/types";
import { PERIODS } from "@/lib/leaderboard/types";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { PlayerTag } from "./Cosmetics";

const PERIOD_LABELS: Record<Period, { fr: string; en: string }> = {
  day: { fr: "Aujourd'hui", en: "Today" },
  week: { fr: "Cette semaine", en: "This week" },
  month: { fr: "Ce mois-ci", en: "This month" },
};

function Row({ rank, you, children, name, look }: { rank: number; you: boolean; name: string; look: GameLeaderRow["look"]; children: React.ReactNode }) {
  return (
    <li className={`flex min-h-14 items-center gap-3 rounded-xl border-2 bg-sea-900 px-3 py-2 ${you ? "border-straw" : "border-transparent"}`}>
      <span className={`w-7 shrink-0 text-center font-display text-[22px] ${rank === 1 ? "text-straw" : "text-mist"}`}>{rank}</span>
      <PlayerTag name={name} look={look} you={you} />
      <span className="shrink-0 text-right">{children}</span>
    </li>
  );
}

/** Invitation à se connecter : seules les parties des comptes sont classées. */
function GuestNote() {
  const { status, accountsEnabled } = usePlayer();
  const t = useT();
  if (status !== "guest" || !accountsEnabled) return null;
  return (
    <p className="text-sm text-mist">
      {t("Seules les parties jouées avec un compte sont classées.", "Only games played with an account are ranked.")}{" "}
      <Link href="/profil" className="font-bold text-straw underline underline-offset-4">
        {t("Se connecter ou créer un compte", "Log in or create an account")}
      </Link>
    </p>
  );
}

/** Classement d'un jeu : la meilleure partie de chaque joueur sur la journée, la semaine ou le mois. */
export function GameLeaderboard({ slug }: { slug: string }) {
  const t = useT();
  const locale = useLocale();
  const [period, setPeriod] = useState<Period>("day");
  const board = useGameLeaderboard(slug, period);
  const difficultyLabel = (id: GameLeaderRow["difficulty"]) => DIFFICULTIES.find((d) => d.id === id)?.label[locale] ?? null;
  const rows = board && board !== "failed" ? [...board.rows, ...(board.you ? [board.you] : [])] : [];

  return (
    <section aria-labelledby="classement-du-jeu" className="space-y-3 rounded-2xl border border-sea-700 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="classement-du-jeu" className="text-lg font-extrabold text-foam">
          {t("Classement", "Leaderboard")}
          {board && board !== "failed" && board.players > 0 && (
            <span className="ml-2 text-sm font-bold text-mist">
              · {board.players} {t(`joueur${board.players > 1 ? "s" : ""}`, board.players === 1 ? "player" : "players")}
            </span>
          )}
        </h2>
        <div className="flex gap-1 rounded-xl bg-sea-900 p-1" role="group" aria-label={t("Période", "Period")}>
          {PERIODS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
              className={`min-h-10 cursor-pointer rounded-[9px] px-3 text-sm font-extrabold transition-colors ${
                period === value ? "bg-straw text-ink" : "text-mist hover:text-foam"
              }`}
            >
              {PERIOD_LABELS[value][locale]}
            </button>
          ))}
        </div>
      </div>
      {board === null ? (
        <LoadingPanel label={t("Chargement du classement…", "Loading the leaderboard…")} />
      ) : board === "failed" ? (
        <p className="text-sm text-mist">{t("Le classement est indisponible pour l'instant.", "The leaderboard is unavailable right now.")}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-mist">
          {t("Personne n'a encore joué sur cette période. À toi d'ouvrir le bal.", "Nobody has played in this period yet. Be the first.")}
        </p>
      ) : (
        <ol className="grid gap-2 md:grid-cols-2">
          {rows.map((row) => (
            <Row key={row.username} rank={row.rank} you={row.you} name={row.username} look={row.look}>
              <span className="block font-extrabold text-foam">
                {row.score} / {row.maxScore}
              </span>
              <span className="block text-xs text-mist">
                {[difficultyLabel(row.difficulty), formatAgo(new Date(row.playedAt), locale)].filter(Boolean).join(" · ")}
              </span>
            </Row>
          ))}
        </ol>
      )}
      <p className="text-xs text-mist">
        {t(
          "Une ligne par joueur : sa meilleure partie sur la période, à l'heure de Paris. À égalité de points, la difficulté départage, puis la partie la plus ancienne.",
          "One line per player: their best game in the period, Paris time. Ties go to the higher difficulty, then to the earlier game.",
        )}
      </p>
      <GuestNote />
    </section>
  );
}

/** Classement général du site : les comptes par prime. */
export function GlobalLeaderboard() {
  const t = useT();
  const locale = useLocale();
  const board = useGlobalLeaderboard();
  const rows = board && board !== "failed" ? [...board.rows, ...(board.you ? [board.you] : [])] : [];
  const bounty = (row: GlobalLeaderRow) => playerBounty({ lifetimeBerrys: row.lifetimeBerrys });

  return (
    <section aria-labelledby="classement-general" className="space-y-4">
      <h2 id="classement-general" className="sr-only">
        {t("Les joueurs par prime", "Players by bounty")}
      </h2>
      {board === null ? (
        <LoadingPanel label={t("Chargement du classement…", "Loading the leaderboard…")} />
      ) : board === "failed" ? (
        <p className="text-mist">{t("Le classement est indisponible pour l'instant.", "The leaderboard is unavailable right now.")}</p>
      ) : (
        <>
          <p className="text-sm font-bold text-mist">
            {board.players} {t(`compte${board.players > 1 ? "s" : ""}`, board.players === 1 ? "account" : "accounts")}
          </p>
          <ol className="grid gap-2 md:grid-cols-2">
            {rows.map((row) => (
              <Row key={row.username} rank={row.rank} you={row.you} name={row.username} look={row.look}>
                <span className="block font-extrabold text-foam">{formatBounty(bounty(row), locale)}</span>
                <span className="block text-xs text-mist">
                  {rankOf(bounty(row)).title[locale]} · {formatNumber(row.games, locale)} {t(`partie${row.games > 1 ? "s" : ""}`, row.games === 1 ? "game" : "games")}
                </span>
              </Row>
            ))}
          </ol>
        </>
      )}
      <GuestNote />
    </section>
  );
}
