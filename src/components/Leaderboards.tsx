"use client";

import Link from "@/components/Link";
import { useState } from "react";
import { DIFFICULTIES, type Difficulty } from "@/games/engine/difficulty";
import { formatBounty, formatNumber } from "@/games/engine/text";
import { LoadingPanel } from "@/games/ui/WithGameData";
import { formatAgo } from "@/lib/admin/format";
import { playerBounty, rankOf } from "@/lib/economy";
import { hasDifficulty } from "@/lib/games/catalog";
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

/** Les trois premiers ont leur couleur : or, argent, bronze. */
const PODIUM: Record<number, string> = {
  1: "bg-straw text-ink",
  2: "bg-[#c9d3df] text-ink",
  3: "bg-[#c48a5a] text-ink",
};

/**
 * Un joueur du classement, dans une carte comme celles des jeux du jour : son rang en badge, son
 * pseudo, et sa marque à droite. Toute la carte mène à sa page : collection, équipage, amitié.
 */
function Row({ rank, you, children, name, look }: { rank: number; you: boolean; name: string; look: GameLeaderRow["look"]; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={`/joueurs/${encodeURIComponent(name)}`}
        className={`flex min-h-14 items-center gap-3 rounded-xl border bg-sea-800 px-3.5 py-2 transition-colors hover:border-straw ${
          you ? "border-straw" : "border-sea-600"
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] font-display text-lg ${PODIUM[rank] ?? "bg-sea-700 text-foam"}`}
        >
          {rank}
        </span>
        <span className="sr-only">{rank}.</span>
        <PlayerTag name={name} look={look} you={you} />
        <span className="shrink-0 text-right">{children}</span>
      </Link>
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

/** Une liste de joueurs d'un jeu, pour une période et un niveau (ou tous). */
function LevelBoard({ slug, period, difficulty, title }: { slug: string; period: Period; difficulty: Difficulty | null; title: string | null }) {
  const t = useT();
  const locale = useLocale();
  const board = useGameLeaderboard(slug, period, difficulty);
  const rows = board && board !== "failed" ? [...board.rows, ...(board.you ? [board.you] : [])] : [];
  return (
    <div className="space-y-2">
      {title && (
        <h3 className="flex items-baseline justify-between gap-2 px-1 text-sm font-extrabold tracking-wide text-mist uppercase">
          {title}
          {board && board !== "failed" && board.players > 0 && (
            <span className="font-bold normal-case">
              {board.players} {t(`joueur${board.players > 1 ? "s" : ""}`, board.players === 1 ? "player" : "players")}
            </span>
          )}
        </h3>
      )}
      {board === null ? (
        <LoadingPanel label={t("Chargement…", "Loading…")} />
      ) : board === "failed" ? (
        <p className="text-sm text-mist">{t("Le classement est indisponible pour l'instant.", "The leaderboard is unavailable right now.")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sea-600 px-3.5 py-3 text-sm text-mist">
          {t("Personne n'a encore joué sur cette période.", "Nobody has played in this period yet.")}
        </p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row) => (
            <Row key={row.username} rank={row.rank} you={row.you} name={row.username} look={row.look}>
              <span className="block font-extrabold text-straw">{row.score}</span>
              <span className="block text-xs text-mist">{formatAgo(new Date(row.playedAt), locale)}</span>
            </Row>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Classement d'un jeu : la meilleure partie de chaque joueur sur la journée, la semaine ou le mois.
 * Un jeu à niveaux a une colonne par niveau, de l'expert au facile ; les autres, une seule liste.
 */
export function GameLeaderboard({ slug }: { slug: string }) {
  const t = useT();
  const locale = useLocale();
  const [period, setPeriod] = useState<Period>("day");
  const levels = hasDifficulty(slug);

  return (
    <section aria-labelledby="classement-du-jeu" className="space-y-3 rounded-2xl border border-sea-700 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="classement-du-jeu" className="text-lg font-extrabold text-foam">
          {t("Classement", "Leaderboard")}
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
      {/* Un jeu à niveaux : une colonne par niveau, séparées d'un trait ; empilées sur téléphone, le trait passe entre elles */}
      {levels ? (
        <div className="grid divide-y divide-sea-700 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {[...DIFFICULTIES].reverse().map((level) => (
            <div key={level.id} className="py-4 first:pt-0 last:pb-0 lg:px-4 lg:py-0 lg:first:pl-0 lg:last:pr-0">
              <LevelBoard slug={slug} period={period} difficulty={level.id} title={level.label[locale]} />
            </div>
          ))}
        </div>
      ) : (
        <LevelBoard slug={slug} period={period} difficulty={null} title={null} />
      )}
      <p className="text-xs text-mist">
        {t(
          "Une ligne par joueur : sa meilleure partie sur la période. À égalité, la partie la plus ancienne passe devant.",
          "One line per player: their best game in the period. Ties go to the earlier game.",
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
                <span className="block font-extrabold text-straw">{formatBounty(bounty(row), locale)}</span>
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
