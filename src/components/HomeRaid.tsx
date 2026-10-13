"use client";

import { Suspense, use, useMemo } from "react";
import Link from "@/components/Link";
import { resolveGameData } from "@/games/cards";
import { formatNumber } from "@/games/engine/text";
import { loadGameData } from "@/games/ui/data";
import { Portrait } from "@/games/ui/Portrait";
import { useIsClient } from "@/games/ui/storage";
import { useLocale, useT } from "@/lib/i18n/client";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { useRaid } from "@/lib/raid/client";
import { BOSS_KINDS } from "@/lib/raid/rules";
import type { RaidView } from "@/lib/raid/types";

function Banner({ raid }: { raid: RaidView }) {
  const t = useT();
  const locale = useLocale();
  const raw = use(loadGameData(locale));
  // Les adversaires sont tous connus de ceux qui ne suivent que l'anime : ce mode ne révèle rien
  const boss = useMemo(() => resolveGameData(raw, "anime").characterById.get(raid.boss.id) ?? null, [raw, raid.boss.id]);
  const left = Math.max(0, raid.hp - raid.damage);
  const attacksLeft = raid.you?.attacksLeft ?? null;

  return (
    <Link
      href="/raid"
      aria-label={t("Raid de la semaine : rejoindre le combat", "Raid of the week: join the fight")}
      className="flex items-center gap-4 rounded-2xl border-4 border-parchment-dark bg-parchment p-4 text-ink transition-opacity hover:opacity-90 sm:gap-5 sm:p-5"
    >
      {boss?.img && <Portrait img={boss.img} className="h-20 w-16 shrink-0 border-parchment-dark sm:h-24 sm:w-[76px]" />}
      <span className="min-w-0 flex-1 space-y-2">
        <span className="block text-xs font-extrabold tracking-[0.2em] uppercase">
          {t("Raid de la semaine", "Raid of the week")} ·{" "}
          {t(`encore ${raid.daysLeft} jour${raid.daysLeft > 1 ? "s" : ""}`, `${raid.daysLeft} ${raid.daysLeft === 1 ? "day" : "days"} left`)}
        </span>
        <span className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-display text-3xl leading-none tracking-wide sm:text-4xl">{boss?.name ?? "· · ·"}</span>
          <span className="text-sm font-bold">{BOSS_KINDS[locale][raid.boss.kind]}</span>
        </span>
        <span
          role="progressbar"
          aria-label={t("Points de vie de l'adversaire", "Boss hit points")}
          aria-valuemin={0}
          aria-valuemax={raid.hp}
          aria-valuenow={left}
          className="block h-3 overflow-hidden rounded-full bg-parchment-dark"
        >
          <span className="block h-full bg-vest" style={{ width: `${(left / raid.hp) * 100}%` }} />
        </span>
        <span className="flex flex-wrap justify-between gap-x-3 text-[13px] font-bold">
          <span>
            {t(
              `${formatNumber(left, "fr")} points de vie sur ${formatNumber(raid.hp, "fr")}`,
              `${formatNumber(left, "en")} of ${formatNumber(raid.hp, "en")} hit points`,
            )}
          </span>
          <span>
            {t(
              `${raid.participants} pirate${raid.participants > 1 ? "s" : ""} au combat`,
              `${raid.participants} ${raid.participants === 1 ? "pirate" : "pirates"} in the fight`,
            )}
          </span>
        </span>
      </span>
      <span className="hidden shrink-0 rounded-xl bg-ink px-4 py-2.5 text-center text-sm font-extrabold text-parchment sm:block">
        {attacksLeft === null
          ? t("Rejoindre le raid", "Join the raid")
          : attacksLeft > 0
            ? t(`Attaquer · ${attacksLeft} assaut${attacksLeft > 1 ? "s" : ""} aujourd'hui`, `Attack · ${attacksLeft} ${attacksLeft === 1 ? "assault" : "assaults"} today`)
            : t("Assauts du jour lancés", "Today's assaults used")}
      </span>
    </Link>
  );
}

/**
 * Sur l'accueil : l'adversaire de la semaine et sa jauge, tant qu'il tient debout.
 * Une fois vaincu, la bannière s'efface ; la page du raid garde le butin à récupérer.
 */
export function HomeRaid() {
  const { accountsEnabled } = usePlayer();
  const isClient = useIsClient();
  const { raid } = useRaid(accountsEnabled);
  if (!isClient || !raid || raid.defeated) return null;
  return (
    <Suspense fallback={null}>
      <Banner raid={raid} />
    </Suspense>
  );
}
