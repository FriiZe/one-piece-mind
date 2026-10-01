"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CharacterCard } from "@/components/CharacterCard";
import { PlayerTag, useCosmeticName } from "@/components/Cosmetics";
import Link from "@/components/Link";
import type { ResolvedData } from "@/games/cards";
import { formatNumber } from "@/games/engine/text";
import { Portrait } from "@/games/ui/Portrait";
import { Button, Panel } from "@/games/ui/primitives";
import { LoadingPanel, WithGameData } from "@/games/ui/WithGameData";
import { useLocale, useT } from "@/lib/i18n/client";
import { notificationsChanged, useNow } from "@/lib/multi/client";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { claimRaidLootAction, finishRaidAttackAction, startRaidAttackAction } from "@/lib/player/raid-actions";
import { useRaid } from "@/lib/raid/client";
import {
  BOSS_KINDS,
  RAID_ATTACKS_PER_DAY,
  RAID_BASE_DAMAGE,
  RAID_LOOT,
  RAID_PERFECT_BONUS,
  RAID_QUESTIONS,
  RAID_SECONDS,
  raidCrewBonus,
} from "@/lib/raid/rules";
import { RAID_ERRORS, type RaidAttackResult, type RaidLootView, type RaidQuestion, type RaidView as Raid } from "@/lib/raid/types";

const percent = (value: number) => Math.round(value * 100);

/** L'adversaire de la semaine et sa jauge de points de vie. */
function Boss({ raid, data }: { raid: Raid; data: ResolvedData }) {
  const t = useT();
  const locale = useLocale();
  const boss = data.characterById.get(raid.boss.id) ?? null;
  const left = Math.max(0, raid.hp - raid.damage);
  return (
    <section aria-label={t("Adversaire de la semaine", "This week's boss")} className="flex flex-col gap-5 rounded-xl border-4 border-parchment-dark bg-parchment p-5 text-ink sm:flex-row sm:items-center sm:p-6">
      <div className="mx-auto w-36 shrink-0 sm:mx-0 sm:w-40">
        <CharacterCard character={boss} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="text-xs font-extrabold tracking-[0.25em] uppercase">
            {t("Raid de la semaine", "Raid of the week")} · {BOSS_KINDS[locale][raid.boss.kind]}
          </p>
          <h2 className="font-display text-4xl leading-none tracking-wide sm:text-5xl">{boss?.name ?? "· · ·"}</h2>
        </div>
        <div className="space-y-1.5">
          <div
            role="progressbar"
            aria-label={t("Points de vie de l'adversaire", "Boss hit points")}
            aria-valuemin={0}
            aria-valuemax={raid.hp}
            aria-valuenow={left}
            className="h-4 overflow-hidden rounded-full bg-parchment-dark"
          >
            <div className="h-full bg-vest transition-[width] duration-500" style={{ width: `${(left / raid.hp) * 100}%` }} />
          </div>
          <p className="flex flex-wrap justify-between gap-x-3 text-sm font-bold">
            <span>
              {raid.defeated
                ? t("Vaincu !", "Defeated!")
                : t(
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
          </p>
        </div>
        <p className="text-sm">
          {raid.defeated
            ? t(
                "L'équipage a gagné : chaque pirate qui a pris part au combat peut récupérer son butin. Un nouvel adversaire arrive lundi.",
                "The crew has won: every pirate who joined the fight can claim their loot. A new boss arrives on Monday.",
              )
            : t(
                `Toute la communauté l'affronte jusqu'à dimanche soir : encore ${raid.daysLeft} jour${raid.daysLeft > 1 ? "s" : ""}. S'il tombe, chaque pirate qui lui a infligé ${formatNumber(RAID_LOOT.minDamage, "fr")} dégâts reçoit ${formatNumber(RAID_LOOT.berrys, "fr")} ฿ et son avis de recherche, doré pour les ${RAID_LOOT.podium} premiers.`,
                `The whole community takes it on until Sunday night: ${raid.daysLeft} ${raid.daysLeft === 1 ? "day" : "days"} left. If it falls, every pirate who dealt ${formatNumber(RAID_LOOT.minDamage, "en")} damage gets ${formatNumber(RAID_LOOT.berrys, "en")} ฿ and its wanted poster, golden for the top ${RAID_LOOT.podium}.`,
              )}
        </p>
      </div>
    </section>
  );
}

/** Un assaut : dix questions, un chrono par question. Les réponses ne partent qu'à la fin ; le serveur compte. */
function Assault({
  attackId,
  questions,
  onDone,
}: {
  attackId: string;
  questions: RaidQuestion[];
  onDone: (result: RaidAttackResult, answers: (string | null)[]) => void;
}) {
  const t = useT();
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const now = useNow(true);
  const index = answers.length;
  const done = index >= questions.length;
  const sent = useRef(false);

  /** `at` : la question à laquelle on répond. Un chrono qui expire juste après un clic ne compte pas une seconde réponse. */
  const answer = useCallback((at: number, optionId: string | null) => {
    setAnswers((current) => (current.length === at ? [...current, optionId] : current));
    setStartedAt(Date.now());
  }, []);

  useEffect(() => {
    if (done) return;
    const timer = window.setTimeout(() => answer(index, null), RAID_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [index, done, answer]);

  useEffect(() => {
    if (!done || sent.current) return;
    sent.current = true;
    finishRaidAttackAction(attackId, answers)
      .catch((): RaidAttackResult => ({ ok: false, error: "unavailable" }))
      .then((result) => onDone(result, answers));
  }, [done, attackId, answers, onDone]);

  if (done) return <LoadingPanel label={t("Assaut terminé : calcul des dégâts…", "Assault over: working out the damage…")} />;

  const question = questions[index];
  const total = RAID_SECONDS * 1000;
  const remaining = now === 0 ? total : Math.max(0, Math.min(total, startedAt + total - now));
  return (
    <section aria-label={t("Assaut", "Assault")} className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="text-[15px] font-extrabold whitespace-nowrap text-foam">
          Question {index + 1} / {questions.length}
        </span>
        <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-sea-700" aria-hidden="true">
          <div
            className={`h-full transition-[width] duration-200 ease-linear ${remaining < 4000 ? "bg-vest" : "bg-straw"}`}
            style={{ width: `${(remaining / total) * 100}%` }}
          />
        </div>
        <span aria-live="off" className="w-14 text-right font-display text-[34px] leading-none tracking-wide whitespace-nowrap text-straw">
          {Math.ceil(remaining / 1000)} s
        </span>
      </div>

      <div className="space-y-2 rounded-[20px] border border-sea-700 bg-sea-800 p-6 text-center sm:p-8">
        <p className="text-xs font-extrabold tracking-[0.15em] text-mist uppercase">{question.title}</p>
        {question.img && <Portrait img={question.img} />}
        <p className="text-2xl leading-tight font-extrabold text-foam sm:text-[30px]">{question.subject}</p>
        {question.detail && <p className="text-mist">{question.detail}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {question.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => answer(index, option.id)}
            className="flex min-h-[72px] cursor-pointer items-center gap-3 rounded-2xl border-2 border-sea-600 bg-sea-800 px-4 py-3 text-left transition-colors hover:border-straw"
          >
            {option.img && <Portrait img={option.img} className="h-20 w-16 shrink-0" />}
            <span className="min-w-0">
              <span className="block text-lg font-extrabold text-foam">{option.label}</span>
              {option.detail && <span className="block text-sm text-mist">{option.detail}</span>}
            </span>
          </button>
        ))}
      </div>
      <p className="text-center text-[15px] text-mist">
        {t(
          "Chaque bonne réponse frappe l'adversaire. La correction arrive à la fin de l'assaut.",
          "Every right answer hits the boss. You'll see the answers at the end of the assault.",
        )}
      </p>
    </section>
  );
}

type Finished = { result: Extract<RaidAttackResult, { ok: true }>; questions: RaidQuestion[]; answers: (string | null)[] };

/** Bilan d'un assaut : les dégâts, puis la correction de chaque question. */
function Report({ finished, onClose }: { finished: Finished; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const { result, questions, answers } = finished;
  return (
    <div className="space-y-5">
      <div role="status" className="rounded-2xl bg-parchment p-5 text-ink sm:p-6">
        <p className="text-sm font-bold tracking-[0.25em] uppercase">
          {result.finisher ? t("Coup de grâce !", "Finishing blow!") : t("Assaut terminé", "Assault over")}
        </p>
        <h2 className="mt-1.5 font-display text-4xl tracking-wide">
          {t(`${formatNumber(result.damage, "fr")} dégâts`, `${formatNumber(result.damage, "en")} damage`)}
        </h2>
        <p className="mt-1 font-semibold">
          {t(
            `${result.correct} bonne${result.correct > 1 ? "s" : ""} réponse${result.correct > 1 ? "s" : ""} sur ${questions.length}`,
            `${result.correct} of ${questions.length} correct`,
          )}
          {result.crewBonus > 0 && t(`, +${percent(result.crewBonus)} % grâce à ton équipage`, `, +${percent(result.crewBonus)}% thanks to your crew`)}
          {result.correct >= questions.length &&
            t(`, +${percent(RAID_PERFECT_BONUS)} % pour le sans-faute`, `, +${percent(RAID_PERFECT_BONUS)}% for the perfect run`)}
          .
        </p>
        <p className="mt-2 font-display text-3xl tracking-wide text-vest-dark">+{formatNumber(result.berrys, locale)} ฿</p>
        <div className="mt-4">
          <Button onClick={onClose}>{t("Retour au raid", "Back to the raid")}</Button>
        </div>
      </div>

      <Panel className="space-y-3">
        <h2 className="font-display text-2xl tracking-wide text-straw">{t("Correction", "Answers")}</h2>
        <ol className="space-y-2.5">
          {questions.map((question, index) => {
            const right = result.answers[index];
            const chosen = answers[index];
            const good = chosen === right.answerId;
            const label = (id: string | null) => question.options.find((option) => option.id === id)?.label;
            return (
              <li key={index} className="rounded-xl bg-sea-900 px-4 py-3">
                <p className="text-sm text-mist">
                  {question.title} · <strong className="text-foam">{question.subject}</strong>
                </p>
                <p className={`font-extrabold ${good ? "text-emerald-300" : "text-vest"}`}>
                  {good ? "✓" : "✗"} {chosen ? label(chosen) : t("Pas de réponse", "No answer")}
                  {!good && <span className="font-semibold text-foam"> → {label(right.answerId)}</span>}
                </p>
                <p className="text-sm text-mist">{right.explanation}</p>
              </li>
            );
          })}
        </ol>
      </Panel>
    </div>
  );
}

/** Butin d'un raid vaincu, à récupérer. */
function Loot({ loot, data, onClaimed }: { loot: RaidLootView; data: ResolvedData; onClaimed: () => void }) {
  const t = useT();
  const locale = useLocale();
  const { sync } = usePlayer();
  const cosmeticName = useCosmeticName();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const boss = data.characterById.get(loot.bossId)?.name ?? "…";

  async function claim() {
    setBusy(true);
    const result = await claimRaidLootAction(loot.week).catch(() => ({ ok: false, error: "unavailable" }) as const);
    setBusy(false);
    if (!result.ok) {
      setMessage({ text: RAID_ERRORS[locale][result.error], ok: false });
      return;
    }
    sync(result.state);
    notificationsChanged();
    const title = cosmeticName(result.cosmetic);
    setMessage({
      ok: true,
      text: t(
        `Butin récupéré : ${formatNumber(result.berrys, "fr")} ฿ et l'avis ${result.golden ? "doré " : ""}de ${boss}${title ? `, plus le titre « ${title} »` : ""}.`,
        `Loot claimed: ${formatNumber(result.berrys, "en")} ฿ and ${boss}'s ${result.golden ? "golden " : ""}poster${title ? `, plus the title “${title}”` : ""}.`,
      ),
    });
    onClaimed();
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-straw/50 bg-straw/5 px-5 py-4">
      <p className="min-w-0 flex-1" aria-live="polite">
        {message ? (
          <span className={`font-semibold ${message.ok ? "text-emerald-300" : "text-vest"}`}>{message.text}</span>
        ) : (
          <>
            <strong className="text-foam">{t(`${boss} est vaincu !`, `${boss} has been defeated!`)}</strong>{" "}
            <span className="text-mist">
              {t(
                `Tu finis ${loot.rank}${loot.rank === 1 ? "er" : "e"} : ${formatNumber(loot.berrys, "fr")} ฿ et son avis de recherche${loot.golden ? " doré" : ""} t'attendent.`,
                `You finished #${loot.rank}: ${formatNumber(loot.berrys, "en")} ฿ and its ${loot.golden ? "golden " : ""}wanted poster are waiting for you.`,
              )}
            </span>
          </>
        )}
      </p>
      {!message?.ok && (
        <Button onClick={claim} disabled={busy}>
          {busy ? t("Récupération…", "Claiming…") : t("Récupérer le butin", "Claim the loot")}
        </Button>
      )}
    </div>
  );
}

function Leaderboard({ raid }: { raid: Raid }) {
  const t = useT();
  const locale = useLocale();
  return (
    <aside aria-labelledby="degats" className="space-y-3.5 rounded-[20px] border border-sea-700 bg-sea-800 p-5">
      <h2 id="degats" className="text-lg font-extrabold text-foam">
        {t("Les plus gros dégâts", "Top damage dealers")}
      </h2>
      {raid.leaderboard.length === 0 ? (
        <p className="text-sm text-mist">{t("Personne n'a encore attaqué. À toi le premier coup.", "Nobody has attacked yet. Land the first blow.")}</p>
      ) : (
        <ol className="space-y-2">
          {raid.leaderboard.map((row) => (
            <li
              key={row.username}
              className={`flex min-h-14 items-center gap-3 rounded-xl border-2 bg-sea-900 px-3 py-2 ${row.you ? "border-straw" : "border-transparent"}`}
            >
              <span className={`w-6 text-center font-display text-[22px] ${row.rank <= RAID_LOOT.podium ? "text-straw" : "text-mist"}`}>{row.rank}</span>
              <PlayerTag name={row.username} look={row.look} you={row.you} />
              <span className="font-extrabold text-foam">{formatNumber(row.damage, locale)}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

function Loaded({ data }: { data: ResolvedData }) {
  const t = useT();
  const locale = useLocale();
  const { status, accountsEnabled, state, sync } = usePlayer();
  const { raid, failed, reload } = useRaid(accountsEnabled);
  const [attack, setAttack] = useState<{ attackId: string; questions: RaidQuestion[] } | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const result = await startRaidAttackAction(data.mode, locale).catch(() => ({ ok: false, error: "unavailable" }) as const);
    setBusy(false);
    if (result.ok) setAttack({ attackId: result.attackId, questions: result.questions });
    else setError(RAID_ERRORS[locale][result.error]);
    reload();
  }

  function done(result: RaidAttackResult, answers: (string | null)[]) {
    if (!result.ok) setError(RAID_ERRORS[locale][result.error]);
    else if (attack) {
      setFinished({ result, questions: attack.questions, answers });
      sync(result.state);
    }
    setAttack(null);
    reload();
  }

  if (failed) {
    return (
      <Panel>
        <p className="font-semibold text-vest">{RAID_ERRORS[locale].unavailable}</p>
      </Panel>
    );
  }
  if (!raid) return <LoadingPanel label={t("Chargement du raid…", "Loading the raid…")} />;
  if (attack) return <Assault attackId={attack.attackId} questions={attack.questions} onDone={done} />;
  if (finished) return <Report finished={finished} onClose={() => setFinished(null)} />;

  const crewBonus = raidCrewBonus(state, data.characterById);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {raid.loot.map((loot) => (
          <Loot key={loot.week} loot={loot} data={data} onClaimed={reload} />
        ))}
        <Boss raid={raid} data={data} />

        <section aria-label={t("Mes assauts", "My assaults")} className="space-y-4 rounded-[20px] border-2 border-straw bg-straw/5 p-5 sm:p-6">
          {raid.you ? (
            <>
              <dl className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: t("mes dégâts", "my damage"), value: formatNumber(raid.you.damage, locale) },
                  { label: t("ma place", "my rank"), value: raid.you.rank === null ? "—" : String(raid.you.rank) },
                  { label: t("assauts restants aujourd'hui", "assaults left today"), value: `${raid.you.attacksLeft} / ${RAID_ATTACKS_PER_DAY}` },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-col-reverse">
                    <dt className="text-[13px] text-mist">{stat.label}</dt>
                    <dd className="font-display text-[28px] tracking-wide text-foam">{stat.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-mist">
                {t(
                  `Un assaut, c'est ${RAID_QUESTIONS} questions, ${RAID_SECONDS} secondes chacune : ${RAID_BASE_DAMAGE} dégâts par bonne réponse, +${percent(RAID_PERFECT_BONUS)} % pour un sans-faute.`,
                  `An assault is ${RAID_QUESTIONS} questions, ${RAID_SECONDS} seconds each: ${RAID_BASE_DAMAGE} damage per right answer, +${percent(RAID_PERFECT_BONUS)}% for a perfect run.`,
                )}{" "}
                {crewBonus > 0
                  ? t(`Ton équipage ajoute ${percent(crewBonus)} % de dégâts :`, `Your crew adds ${percent(crewBonus)}% damage:`)
                  : t("Un équipage à ses postes frappe plus fort :", "A crew at its posts hits harder:")}{" "}
                <Link href="/navire" className="font-bold text-straw underline underline-offset-4">
                  {crewBonus > 0 ? t("le renforcer", "strengthen it") : t("composer le mien", "set up mine")}
                </Link>
                .
              </p>
              {!raid.defeated && (
                <Button onClick={start} disabled={busy || raid.you.attacksLeft === 0} className="min-h-[52px] px-7 text-[17px]">
                  {busy
                    ? t("Préparation…", "Getting ready…")
                    : raid.you.attacksLeft === 0
                      ? t("Plus d'assaut aujourd'hui", "No assaults left today")
                      : t("Lancer un assaut", "Launch an assault")}
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-mist">
                {status === "loading"
                  ? t("Chargement…", "Loading…")
                  : t(
                      "Le raid se joue avec un compte : tes dégâts s'ajoutent à ceux des autres pirates, et le butin te revient.",
                      "The raid is played with an account: your damage adds to the other pirates', and the loot is yours.",
                    )}
              </p>
              {status === "guest" && (
                <Link href="/profil#compte" className="inline-block rounded-lg bg-straw px-4 py-2.5 font-bold text-ink hover:bg-straw-dark">
                  {t("Se connecter ou créer un compte", "Log in or create an account")}
                </Link>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="font-semibold text-vest">
              {error}
            </p>
          )}
        </section>
      </div>
      <Leaderboard raid={raid} />
    </div>
  );
}

export function RaidView() {
  const t = useT();
  const { status, accountsEnabled } = usePlayer();
  if (status !== "loading" && !accountsEnabled) {
    return (
      <Panel>
        <p className="text-mist">{t("Le raid n'est pas disponible sur cette version du site.", "The raid isn't available on this version of the site.")}</p>
      </Panel>
    );
  }
  return <WithGameData loading={t("Chargement du raid…", "Loading the raid…")}>{({ data }) => <Loaded data={data} />}</WithGameData>;
}
