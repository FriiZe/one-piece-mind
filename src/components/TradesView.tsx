"use client";

import { useMemo, useState } from "react";
import Link from "@/components/Link";
import type { PlayCharacter, ResolvedData } from "@/games/cards";
import { Button, Panel } from "@/games/ui/primitives";
import { LoadingPanel, WithGameData } from "@/games/ui/WithGameData";
import { collectionCopies, exchangeLockNote, type CollectionCopy, type CollectionEntry } from "@/lib/economy";
import type { Locale } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { notificationsChanged, useFriendCollection, useFriends, useTrades } from "@/lib/multi/client";
import { TRADE_ERRORS, TRADE_LIMITS, tradeLineKey, type TradeLine, type TradeResult, type TradeView } from "@/lib/multi/trades";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { answerTradeAction, cancelTradeAction, proposeTradeAction } from "@/lib/player/trade-actions";
import { CharacterCard } from "./CharacterCard";

/** Une version d'un avis : ordinaire ou dorée, les deux ne se valent pas. */
type Copy = { id: string; golden: boolean };

const total = (lines: TradeLine[]) => lines.reduce((sum, line) => sum + line.count, 0);
const chosenCount = (lines: TradeLine[], copy: Copy) => lines.find((line) => tradeLineKey(line) === tradeLineKey(copy))?.count ?? 0;

/** Ajoute ou retire un exemplaire d'une version à un côté de l'échange. */
function adjust(lines: TradeLine[], copy: Copy, delta: 1 | -1): TradeLine[] {
  const count = chosenCount(lines, copy) + delta;
  const others = lines.filter((line) => tradeLineKey(line) !== tradeLineKey(copy));
  return count > 0 ? [...others, { ...copy, count }] : others;
}

/** Le joueur donne-t-il tous ses exemplaires d'un des avis : il quittera alors sa collection et son équipage. */
function givesLastCopy(lines: TradeLine[], collection: Record<string, CollectionEntry>): boolean {
  return lines.some((line) => {
    const entry = collection[line.id];
    const given = lines.filter((other) => other.id === line.id).reduce((sum, other) => sum + other.count, 0);
    return !!entry && given >= entry.count;
  });
}

/** Les avis d'une liste, en toutes lettres : « Namur ×2, Luffy doré ». */
function describe(lines: TradeLine[], data: ResolvedData, t: ReturnType<typeof useT>): string {
  return lines
    .map((line) => {
      const name = data.characterById.get(line.id)?.name ?? "?";
      const label = line.golden ? t(`${name} doré`, `golden ${name}`) : name;
      return line.count > 1 ? `${label} ×${line.count}` : label;
    })
    .join(", ");
}

const sortLines = (lines: TradeLine[], data: ResolvedData) =>
  [...lines].sort(
    (a, b) =>
      (data.characterById.get(a.id)?.tier ?? 9) - (data.characterById.get(b.id)?.tier ?? 9) ||
      a.id.localeCompare(b.id) ||
      Number(a.golden) - Number(b.golden),
  );

/** Un avis dans une proposition. Un personnage que le mode du joueur ne montre pas encore reste caché. */
function TradeCard({ id, golden, count, data }: TradeLine & { data: ResolvedData }) {
  const character = data.characterById.get(id) ?? null;
  const t = useT();
  return (
    <li className="w-20 shrink-0 text-center sm:w-24">
      <CharacterCard character={character} golden={golden} count={count} note={golden ? t("Doré", "Golden") : undefined} />
      {!character && <p className="mt-1 text-xs text-mist">{t("Pas encore vu dans ton mode", "Not seen yet in your mode")}</p>}
    </li>
  );
}

/** Un côté d'une proposition : les avis qu'on donne, ou ceux qu'on reçoit. */
function TradeSide({ lines, data, label }: { lines: TradeLine[]; data: ResolvedData; label: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-bold text-mist">
        {label} · {total(lines)}
      </p>
      <ul className="flex flex-wrap gap-2">
        {sortLines(lines, data).map((line) => (
          <TradeCard key={tradeLineKey(line)} {...line} data={data} />
        ))}
      </ul>
    </div>
  );
}

function TradeRow({
  trade,
  data,
  incoming,
  lastCopy,
  busy,
  onAnswer,
  onCancel,
}: {
  trade: TradeView;
  data: ResolvedData;
  incoming: boolean;
  /** Le joueur donne tous ses exemplaires d'un des avis. */
  lastCopy: boolean;
  busy: boolean;
  onAnswer: (accept: boolean) => void;
  onCancel: () => void;
}) {
  const t = useT();
  // Pour celui qui reçoit la proposition, ce qui est offert est ce qu'il reçoit
  const give = incoming ? trade.requested : trade.offered;
  const receive = incoming ? trade.offered : trade.requested;
  return (
    <li
      className={`flex flex-col gap-4 rounded-2xl border p-4 lg:flex-row lg:items-center ${
        incoming ? "border-straw/50 bg-straw/5" : "border-sea-700 bg-sea-800"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TradeSide lines={give} data={data} label={t("Tu donnes", "You give")} />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-7 shrink-0 rotate-90 self-center text-straw sm:rotate-0">
          <path d="M7 8h13M16 4l4 4-4 4M17 16H4M8 12l-4 4 4 4" />
        </svg>
        <TradeSide lines={receive} data={data} label={t("Tu reçois", "You get")} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-mist">
          {incoming ? (
            <>
              <strong className="text-foam">{trade.friend}</strong>{" "}
              {t("te propose cet échange.", "is offering you this trade.")}
            </>
          ) : (
            t(
              <>
                En attente de la réponse de <strong className="text-foam">{trade.friend}</strong>.
              </>,
              <>
                Waiting for <strong className="text-foam">{trade.friend}</strong> to reply.
              </>,
            )
          )}
        </p>
        {lastCopy && (
          <p className="text-sm font-semibold text-straw">
            {t(
              "Tu donnes tous tes exemplaires d'un de ces avis : il quittera ta collection et ton équipage.",
              "You're giving away every copy of one of these posters: it will leave your collection and your crew.",
            )}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {incoming ? (
            <>
              <Button disabled={busy} onClick={() => onAnswer(true)}>
                {t("Accepter", "Accept")}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => onAnswer(false)}>
                {t("Refuser", "Decline")}
              </Button>
            </>
          ) : (
            <Button variant="secondary" disabled={busy} onClick={onCancel}>
              {t("Annuler", "Cancel")}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Grille d'avis dans laquelle on en choisit quelques-uns : chaque clic ajoute un
 * exemplaire, le bouton « − » en retire un. Les exemplaires dorés ont leur propre carte.
 */
function Picker({
  title,
  hint,
  copies,
  selected,
  onChange,
  empty,
}: {
  title: string;
  hint?: string;
  copies: CollectionCopy<PlayCharacter>[];
  selected: TradeLine[];
  onChange: (lines: TradeLine[]) => void;
  empty: string;
}) {
  const t = useT();
  const full = total(selected) >= TRADE_LIMITS.perSide;
  return (
    <div className="space-y-2.5">
      <h3 className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs font-extrabold tracking-[0.15em] text-mist uppercase">
        {title}
        {hint && <span className="text-[13px] font-normal tracking-normal normal-case">{hint}</span>}
      </h3>
      {copies.length === 0 ? (
        <p className="text-sm text-mist">{empty}</p>
      ) : (
        <ul className="grid max-h-[28rem] grid-cols-3 gap-2.5 overflow-y-auto p-1 sm:grid-cols-4">
          {copies.map(({ character, golden, count }) => {
            const copy = { id: character.id, golden };
            const chosen = chosenCount(selected, copy);
            const canAdd = !full && chosen < count;
            return (
              <li key={tradeLineKey(copy)} className="space-y-1">
                <div className={`relative rounded-md ${chosen > 0 ? "ring-4 ring-emerald-400" : canAdd ? "" : "opacity-50"}`}>
                  <CharacterCard character={character} golden={golden} count={count} note={golden ? t("Doré", "Golden") : undefined} />
                  <button
                    type="button"
                    onClick={() => onChange(adjust(selected, copy, 1))}
                    disabled={!canAdd}
                    aria-label={
                      golden
                        ? t(`Ajouter un ${character.name} doré`, `Add a golden ${character.name}`)
                        : t(`Ajouter un ${character.name}`, `Add a ${character.name}`)
                    }
                    className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-straw disabled:cursor-not-allowed"
                  />
                </div>
                {chosen > 0 && (
                  <div className="flex items-center justify-between rounded-md bg-emerald-400/15 font-bold whitespace-nowrap text-emerald-300">
                    <button
                      type="button"
                      onClick={() => onChange(adjust(selected, copy, -1))}
                      aria-label={t(`Retirer un ${character.name}`, `Remove a ${character.name}`)}
                      className="min-h-9 min-w-9 cursor-pointer rounded-md text-lg leading-none hover:bg-emerald-400/20"
                    >
                      −
                    </button>
                    <span className="pr-2.5 text-sm" title={t(`${chosen} choisi${chosen > 1 ? "s" : ""}`, `${chosen} picked`)}>
                      ✓ {chosen}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const byRarity = (locale: Locale) => (a: PlayCharacter, b: PlayCharacter) =>
  a.tier - b.tier || a.name.localeCompare(b.name, locale);

function Trades({ data }: { data: ResolvedData }) {
  const { state, refresh } = usePlayer();
  const t = useT();
  const locale = useLocale();
  const { friends } = useFriends(true);
  const { trades, reload } = useTrades(true);
  const [friendId, setFriendId] = useState<string | null>(null);
  const friend = useFriendCollection(friendId);
  const [offered, setOffered] = useState<TradeLine[]>([]);
  const [requested, setRequested] = useState<TradeLine[]>([]);
  const [duplicatesOnly, setDuplicatesOnly] = useState(true);
  const [missingOnly, setMissingOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const mine = useMemo(
    () =>
      collectionCopies(
        data.characters
          .filter((c) => state.collection[c.id] && (!duplicatesOnly || state.collection[c.id].count > 1))
          .sort(byRarity(locale)),
        state.collection,
      ),
    [data.characters, state.collection, duplicatesOnly, locale],
  );
  const theirs = useMemo(
    () =>
      friend && friend !== "missing"
        ? collectionCopies(
            data.characters.filter((c) => friend.collection[c.id] && (!missingOnly || !state.collection[c.id])).sort(byRarity(locale)),
            friend.collection,
          )
        : [],
    [data.characters, friend, state.collection, missingOnly, locale],
  );

  async function run(action: () => Promise<TradeResult>, success: string, changesCollection = false) {
    setBusy(true);
    const result = await action().catch((): TradeResult => ({ ok: false, error: "unavailable" }));
    setBusy(false);
    setMessage(result.ok ? { text: success, ok: true } : { text: TRADE_ERRORS[locale][result.error], ok: false });
    reload();
    notificationsChanged();
    // Un échange accepté change la collection affichée partout sur le site
    if (result.ok && changesCollection) refresh();
    return result.ok;
  }

  async function propose() {
    if (!friendId || offered.length === 0 || requested.length === 0) return;
    const sent = await run(
      () => proposeTradeAction(friendId, offered, requested),
      t("Proposition envoyée.", "Offer sent."),
    );
    if (sent) {
      setOffered([]);
      setRequested([]);
    }
  }

  const lastCopy = givesLastCopy(offered, state.collection);
  const ready = offered.length > 0 && requested.length > 0;

  return (
    <div className="space-y-7">
      <p className={`font-semibold empty:hidden ${message?.ok ? "text-emerald-300" : "text-vest"}`} aria-live="polite">
        {message?.text}
      </p>
      {/* Un compte qui n'a pas encore assez joué voit ses échanges, mais ne peut ni en proposer ni en accepter */}
      {trades && !trades.access.open && (
        <p className="rounded-xl border border-straw/50 bg-straw/5 px-4 py-3 font-semibold text-foam">{exchangeLockNote(trades.access)[locale]}</p>
      )}

      {trades && trades.incoming.length > 0 && (
        <section aria-labelledby="recus" className="space-y-3">
          <h2 id="recus" className="text-xl font-extrabold text-foam">
            {t("Propositions reçues", "Offers received")} · {trades.incoming.length}
          </h2>
          <ul className="space-y-3">
            {trades.incoming.map((trade) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                data={data}
                incoming
                lastCopy={givesLastCopy(trade.requested, state.collection)}
                busy={busy}
                onAnswer={(accept) =>
                  run(
                    () => answerTradeAction(trade.id, accept),
                    accept
                      ? t(
                          "Échange fait : les avis reçus ont rejoint ta collection.",
                          "Trade done: the posters you got have joined your collection.",
                        )
                      : t("Proposition refusée.", "Offer declined."),
                    accept,
                  )
                }
                onCancel={() => undefined}
              />
            ))}
          </ul>
        </section>
      )}

      {trades && trades.outgoing.length > 0 && (
        <section aria-labelledby="envoyes" className="space-y-3">
          <h2 id="envoyes" className="text-xl font-extrabold text-foam">
            {t("Propositions envoyées", "Offers sent")} · {trades.outgoing.length}
          </h2>
          <ul className="space-y-3">
            {trades.outgoing.map((trade) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                data={data}
                incoming={false}
                lastCopy={givesLastCopy(trade.offered, state.collection)}
                busy={busy}
                onAnswer={() => undefined}
                onCancel={() => run(() => cancelTradeAction(trade.id), t("Proposition annulée.", "Offer canceled."))}
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="proposer" className="space-y-3.5">
        <h2 id="proposer" className="text-xl font-extrabold text-foam">
          {t("Proposer un échange", "Offer a trade")}
        </h2>
        {!friends ? (
          <p className="text-mist">{t("Chargement…", "Loading…")}</p>
        ) : friends.friends.length === 0 ? (
          <Panel>
            <p className="text-mist">
              {t("Les échanges se font entre amis.", "Trades happen between friends.")}{" "}
              <Link href="/profil#amis" className="font-semibold text-straw underline underline-offset-4">
                {t("Ajoute un ami", "Add a friend")}
              </Link>{" "}
              {t("par son pseudo pour commencer.", "by username to get started.")}
            </p>
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-2.5 rounded-[14px] border border-sea-700 p-4">
                <h3 className="text-xs font-extrabold tracking-[0.15em] text-mist uppercase">
                  {t("1 · Avec qui", "1 · With whom")}
                </h3>
                <ul className="space-y-2">
                  {friends.friends.map((f) => {
                    const chosen = friendId === f.id;
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          aria-pressed={chosen}
                          onClick={() => {
                            setFriendId(f.id);
                            setRequested([]);
                          }}
                          className={`flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 text-left font-bold transition-colors ${
                            chosen ? "border-2 border-straw bg-sea-800 text-foam" : "border border-sea-700 text-mist hover:text-foam"
                          }`}
                        >
                          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sea-700 text-mist">
                            {f.username.charAt(0).toLocaleUpperCase("fr")}
                          </span>
                          <span className="truncate">{f.username}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <Link href="/profil#amis" className="inline-block text-sm font-bold text-mist underline underline-offset-4 hover:text-foam">
                  {t("Ajouter un ami", "Add a friend")}
                </Link>
              </div>

              <div className="space-y-2.5 rounded-[14px] border border-sea-700 p-4">
                <Picker
                  title={t(`2 · Je donne · ${total(offered)}/${TRADE_LIMITS.perSide}`, `2 · I give · ${total(offered)}/${TRADE_LIMITS.perSide}`)}
                  hint={
                    duplicatesOnly ? t("Mes doublons", "My duplicates") : t("Toute ma collection", "My whole collection")
                  }
                  copies={mine}
                  selected={offered}
                  onChange={setOffered}
                  empty={
                    duplicatesOnly
                      ? t(
                          "Tu n'as aucun doublon. Décoche la case pour proposer un autre avis.",
                          "You have no duplicates. Uncheck the box to offer another poster.",
                        )
                      : t("Ta collection est vide.", "Your collection is empty.")
                  }
                />
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-mist">
                  <input type="checkbox" checked={duplicatesOnly} onChange={(event) => setDuplicatesOnly(event.target.checked)} className="size-[18px] accent-straw" />
                  {t("Seulement mes doublons", "Only my duplicates")}
                </label>
              </div>

              <div className="space-y-2.5 rounded-[14px] border border-sea-700 p-4">
                {!friendId ? (
                  <>
                    <h3 className="text-xs font-extrabold tracking-[0.15em] text-mist uppercase">
                      {t("3 · Je demande", "3 · I ask for")}
                    </h3>
                    <p className="text-sm text-mist">
                      {t(
                        "Choisis d'abord un ami : sa collection s'affichera ici.",
                        "Pick a friend first: their collection will show up here.",
                      )}
                    </p>
                  </>
                ) : friend === null ? (
                  <p className="text-mist">{t("Chargement de sa collection…", "Loading their collection…")}</p>
                ) : friend === "missing" ? (
                  <p className="font-semibold text-vest">
                    {t("Sa collection n'a pas pu être chargée.", "Their collection couldn't be loaded.")}
                  </p>
                ) : (
                  <>
                    <Picker
                      title={t(`3 · Je demande · ${total(requested)}/${TRADE_LIMITS.perSide}`, `3 · I ask for · ${total(requested)}/${TRADE_LIMITS.perSide}`)}
                      hint={
                        missingOnly
                          ? t(`Ce qui me manque chez ${friend.username}`, `What I'm missing from ${friend.username}`)
                          : t(`Toute la collection de ${friend.username}`, `${friend.username}'s whole collection`)
                      }
                      copies={theirs}
                      selected={requested}
                      onChange={setRequested}
                      empty={
                        missingOnly
                          ? t(
                              `${friend.username} n'a aucun avis qui te manque. Décoche la case pour tout voir.`,
                              `${friend.username} has no posters you're missing. Uncheck the box to see everything.`,
                            )
                          : t(`La collection de ${friend.username} est vide.`, `${friend.username}'s collection is empty.`)
                      }
                    />
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-mist">
                      <input type="checkbox" checked={missingOnly} onChange={(event) => setMissingOnly(event.target.checked)} className="size-[18px] accent-straw" />
                      {t("Seulement les avis qui me manquent", "Only posters I'm missing")}
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-sea-700 bg-sea-800 px-5 py-4">
              <p className="min-w-0 flex-1 text-mist">
                {ready && friend && friend !== "missing"
                  ? t(
                      <>
                        Tu donnes <strong className="text-foam">{describe(sortLines(offered, data), data, t)}</strong> à {friend.username} contre{" "}
                        <strong className="text-foam">{describe(sortLines(requested, data), data, t)}</strong>. Rien ne bouge tant que {friend.username} n&apos;a pas accepté.
                      </>,
                      <>
                        You give <strong className="text-foam">{describe(sortLines(offered, data), data, t)}</strong> to {friend.username} for{" "}
                        <strong className="text-foam">{describe(sortLines(requested, data), data, t)}</strong>. Nothing moves until {friend.username} accepts.
                      </>,
                    )
                  : t(
                      `Jusqu'à ${TRADE_LIMITS.perSide} avis de chaque côté : choisis un ami, les avis que tu donnes et ceux que tu demandes. Chaque clic sur une carte en ajoute un exemplaire.`,
                      `Up to ${TRADE_LIMITS.perSide} posters on each side: pick a friend, the posters you give and the ones you ask for. Each click on a card adds one copy.`,
                    )}
                {lastCopy && (
                  <span className="mt-1 block text-sm font-semibold text-straw">
                    {t(
                      "Tu donnes tous tes exemplaires d'un de ces avis : s'il part, il quitte ta collection et ton équipage.",
                      "You're giving every copy of one of these posters: if it goes, it leaves your collection and your crew.",
                    )}
                  </span>
                )}
              </p>
              <Button onClick={propose} disabled={busy || !ready} className="min-h-12 px-6">
                {t("Proposer l'échange", "Offer the trade")}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function TradesView() {
  const { status, accountsEnabled } = usePlayer();
  const t = useT();
  if (status === "loading") return <LoadingPanel />;
  if (status !== "user") {
    return (
      <Panel className="space-y-3">
        <p className="text-mist">
          {accountsEnabled
            ? t(
                "Les échanges se font entre amis, donc entre joueurs qui ont un compte.",
                "Trades happen between friends, so between players who have an account.",
              )
            : t("Les échanges ne sont pas disponibles pour l'instant.", "Trades aren't available right now.")}
        </p>
        {accountsEnabled && (
          <Link href="/profil#compte" className="inline-block rounded-lg bg-straw px-4 py-2.5 font-bold text-ink hover:bg-straw-dark">
            {t("Se connecter ou créer un compte", "Log in or create an account")}
          </Link>
        )}
      </Panel>
    );
  }
  return (
    <WithGameData loading={t("Chargement des échanges…", "Loading trades…")}>{({ data }) => <Trades data={data} />}</WithGameData>
  );
}
