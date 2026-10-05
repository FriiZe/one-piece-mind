"use client";

import { useMemo, useState } from "react";
import Link from "@/components/Link";
import type { PlayCharacter, ResolvedData } from "@/games/cards";
import { Button, Panel } from "@/games/ui/primitives";
import { LoadingPanel, WithGameData } from "@/games/ui/WithGameData";
import { exchangeLockNote, type CollectionEntry } from "@/lib/economy";
import type { Locale } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { notificationsChanged, useFriendCollection, useFriends, useTrades } from "@/lib/multi/client";
import { TRADE_ERRORS, type TradeResult, type TradeView } from "@/lib/multi/trades";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { answerTradeAction, cancelTradeAction, proposeTradeAction } from "@/lib/player/trade-actions";
import { CharacterCard } from "./CharacterCard";

/** Un avis dans une proposition. Un personnage que le mode du joueur ne montre pas encore reste caché. */
function TradeCard({ id, data, label }: { id: string; data: ResolvedData; label: string }) {
  const character = data.characterById.get(id) ?? null;
  const t = useT();
  return (
    <div className="w-24 shrink-0 text-center sm:w-28">
      <p className="mb-1 text-xs font-bold text-mist">{label}</p>
      <CharacterCard character={character} />
      {!character && <p className="mt-1 text-xs text-mist">{t("Pas encore vu dans ton mode", "Not seen yet in your mode")}</p>}
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
  /** L'avis à donner est le seul exemplaire du joueur. */
  lastCopy: boolean;
  busy: boolean;
  onAnswer: (accept: boolean) => void;
  onCancel: () => void;
}) {
  const t = useT();
  // Pour celui qui reçoit la proposition, ce qui est offert est ce qu'il reçoit
  const give = incoming ? trade.requestedId : trade.offeredId;
  const receive = incoming ? trade.offeredId : trade.requestedId;
  return (
    <li
      className={`flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center ${
        incoming ? "border-straw/50 bg-straw/5" : "border-sea-700 bg-sea-800"
      }`}
    >
      <div className="flex items-end gap-2">
        <TradeCard id={give} data={data} label={t("Tu donnes", "You give")} />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mb-12 size-7 shrink-0 text-straw">
          <path d="M7 8h13M16 4l4 4-4 4M17 16H4M8 12l-4 4 4 4" />
        </svg>
        <TradeCard id={receive} data={data} label={t("Tu reçois", "You get")} />
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
              "Tu donnes ton seul exemplaire : il quittera ta collection et ton équipage.",
              "You're giving away your only copy: it will leave your collection and your crew.",
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

/** Grille d'avis dans laquelle on en choisit un. */
function Picker({
  title,
  hint,
  characters,
  collection,
  selected,
  onSelect,
  empty,
}: {
  title: string;
  hint?: string;
  characters: PlayCharacter[];
  collection: Record<string, CollectionEntry>;
  selected: string | null;
  onSelect: (id: string) => void;
  empty: string;
}) {
  const t = useT();
  return (
    <div className="space-y-2.5">
      <h3 className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs font-extrabold tracking-[0.15em] text-mist uppercase">
        {title}
        {hint && <span className="text-[13px] font-normal tracking-normal normal-case">{hint}</span>}
      </h3>
      {characters.length === 0 ? (
        <p className="text-sm text-mist">{empty}</p>
      ) : (
        <ul className="grid max-h-96 grid-cols-3 gap-2.5 overflow-y-auto p-1 sm:grid-cols-4">
          {characters.map((character) => {
            const entry = collection[character.id];
            const chosen = selected === character.id;
            return (
              <li key={character.id} className={`relative rounded-md ${chosen ? "ring-4 ring-emerald-400" : ""}`}>
                <CharacterCard character={character} golden={entry.golden > 0} count={entry.count} />
                <button
                  type="button"
                  onClick={() => onSelect(character.id)}
                  aria-pressed={chosen}
                  aria-label={t(`Choisir ${character.name}`, `Pick ${character.name}`)}
                  className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-straw"
                />
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
  const [offered, setOffered] = useState<string | null>(null);
  const [requested, setRequested] = useState<string | null>(null);
  const [duplicatesOnly, setDuplicatesOnly] = useState(true);
  const [missingOnly, setMissingOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const mine = useMemo(
    () =>
      data.characters
        .filter((c) => state.collection[c.id] && (!duplicatesOnly || state.collection[c.id].count > 1))
        .sort(byRarity(locale)),
    [data.characters, state.collection, duplicatesOnly, locale],
  );
  const theirs = useMemo(
    () =>
      friend && friend !== "missing"
        ? data.characters.filter((c) => friend.collection[c.id] && (!missingOnly || !state.collection[c.id])).sort(byRarity(locale))
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
    if (!friendId || !offered || !requested) return;
    const sent = await run(
      () => proposeTradeAction(friendId, offered, requested),
      t("Proposition envoyée.", "Offer sent."),
    );
    if (sent) {
      setOffered(null);
      setRequested(null);
    }
  }

  const lastCopy = offered ? state.collection[offered]?.count === 1 : false;
  const offeredCharacter = offered ? data.characterById.get(offered) : undefined;
  const requestedCharacter = requested ? data.characterById.get(requested) : undefined;

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
                lastCopy={state.collection[trade.requestedId]?.count === 1}
                busy={busy}
                onAnswer={(accept) =>
                  run(
                    () => answerTradeAction(trade.id, accept),
                    accept
                      ? t(
                          "Échange fait : l'avis a rejoint ta collection.",
                          "Trade done: the poster has joined your collection.",
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
                lastCopy={state.collection[trade.offeredId]?.count === 1}
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
                            setRequested(null);
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
                  title={t("2 · Je donne", "2 · I give")}
                  hint={
                    duplicatesOnly ? t("Mes doublons", "My duplicates") : t("Toute ma collection", "My whole collection")
                  }
                  characters={mine}
                  collection={state.collection}
                  selected={offered}
                  onSelect={setOffered}
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
                      title={t("3 · Je demande", "3 · I ask for")}
                      hint={
                        missingOnly
                          ? t(`Ce qui me manque chez ${friend.username}`, `What I'm missing from ${friend.username}`)
                          : t(`Toute la collection de ${friend.username}`, `${friend.username}'s whole collection`)
                      }
                      characters={theirs}
                      collection={friend.collection}
                      selected={requested}
                      onSelect={setRequested}
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
                {offeredCharacter && requestedCharacter && friend && friend !== "missing"
                  ? t(
                      <>
                        Tu donnes <strong className="text-foam">{offeredCharacter.name}</strong> à {friend.username} contre{" "}
                        <strong className="text-foam">{requestedCharacter.name}</strong>. Rien ne bouge tant que {friend.username} n&apos;a pas accepté.
                      </>,
                      <>
                        You give <strong className="text-foam">{offeredCharacter.name}</strong> to {friend.username} for{" "}
                        <strong className="text-foam">{requestedCharacter.name}</strong>. Nothing moves until {friend.username} accepts.
                      </>,
                    )
                  : t(
                      "Un avis contre un avis : choisis un ami, l'avis que tu donnes et celui que tu demandes.",
                      "One poster for another: pick a friend, the poster you give and the one you ask for.",
                    )}
                {lastCopy && (
                  <span className="mt-1 block text-sm font-semibold text-straw">
                    {t(
                      "C'est ton seul exemplaire de cet avis : s'il part, il quitte ta collection et ton équipage.",
                      "This is your only copy of this poster: if it goes, it leaves your collection and your crew.",
                    )}
                  </span>
                )}
              </p>
              <Button onClick={propose} disabled={busy || !offered || !requested} className="min-h-12 px-6">
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
