"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/Link";
import type { PlayCharacter, ResolvedData } from "@/games/cards";
import { formatNumber } from "@/games/engine/text";
import { Button, Panel } from "@/games/ui/primitives";
import { LoadingPanel, WithGameData } from "@/games/ui/WithGameData";
import { collectionCopies, exchangeLockNote, RARITY_LABELS } from "@/lib/economy";
import { useLocale, useT } from "@/lib/i18n/client";
import { useMarket } from "@/lib/market/client";
import {
  MARKET_MAX_LISTINGS,
  MARKET_SORTS,
  MARKET_TAX,
  marketProceeds,
  PRICE_STEP,
  priceBounds,
  isValidPrice,
  sellableCopies,
  type MarketSort,
} from "@/lib/market/rules";
import { MARKET_ERRORS, type ListingView, type MarketOverview, type MarketResult } from "@/lib/market/types";
import { notificationsChanged } from "@/lib/multi/client";
import { acknowledgeSalesAction, buyListingAction, cancelListingAction, createListingAction } from "@/lib/player/market-actions";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { CharacterCard } from "./CharacterCard";

const FIELD =
  "h-11 rounded-[10px] border border-sea-600 bg-sea-900 px-3 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none";
const LEGEND = "text-xs font-extrabold tracking-[0.15em] text-mist uppercase";

/** Formulaire de mise en vente : un exemplaire en trop, ordinaire ou doré, et son prix. */
function Sell({
  data,
  open,
  busy,
  onSell,
}: {
  data: ResolvedData;
  /** Annonces déjà ouvertes par le joueur. */
  open: number;
  busy: boolean;
  onSell: (characterId: string, golden: boolean, price: number) => Promise<boolean>;
}) {
  const { state } = usePlayer();
  const t = useT();
  const locale = useLocale();
  const [picked, setPicked] = useState<{ id: string; golden: boolean } | null>(null);
  const [price, setPrice] = useState("");

  // Chaque version a sa carte : un doré ne s'empile pas avec les ordinaires du même personnage
  const sellable = useMemo(
    () =>
      collectionCopies(
        [...data.characters].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name, locale)),
        state.collection,
      ).filter(({ character, golden }) => {
        const copies = sellableCopies(state.collection[character.id]);
        return (golden ? copies.golden : copies.plain) > 0;
      }),
    [data.characters, state.collection, locale],
  );
  // L'exemplaire choisi peut avoir quitté la collection entre-temps (vente, échange)
  const chosen = picked
    ? sellable.find(({ character, golden }) => character.id === picked.id && golden === picked.golden)
    : undefined;
  const golden = !!chosen?.golden;
  const bounds = chosen ? priceBounds(chosen.character.tier, golden) : null;
  const amount = Number(price);
  const valid = !!chosen && isValidPrice(amount, chosen.character.tier, golden);
  const full = open >= MARKET_MAX_LISTINGS;

  function pick(character: PlayCharacter, wantsGolden: boolean) {
    setPicked({ id: character.id, golden: wantsGolden });
    setPrice(String(priceBounds(character.tier, wantsGolden).suggested));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!chosen || !valid) return;
    if (await onSell(chosen.character.id, golden, amount)) setPicked(null);
  }

  return (
    <section aria-labelledby="vendre" className="space-y-3.5">
      <h2 id="vendre" className="text-xl font-extrabold text-foam">
        {t("Vendre un avis en trop", "Sell a spare poster")}
      </h2>
      {sellable.length === 0 ? (
        <Panel>
          <p className="text-mist">
            {t(
              "Tu n'as aucun exemplaire en trop : on garde toujours un exemplaire de chaque avis. Les doublons viennent des recrutements et des boosters de",
              "You have no spare copies: you always keep one copy of each poster. Duplicates come from recruits and boosters at",
            )}{" "}
            <Link href="/boutique" className="font-semibold text-straw underline underline-offset-4">
              {t("la boutique", "the shop")}
            </Link>
            .
          </p>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-2.5 rounded-[14px] border border-sea-700 p-4">
            <h3 className={LEGEND}>{t("1 · L'avis à vendre", "1 · The poster to sell")}</h3>
            <ul className="grid max-h-96 grid-cols-3 gap-2.5 overflow-y-auto p-1 sm:grid-cols-4 lg:grid-cols-5">
              {sellable.map(({ character, golden: isGolden, count }) => {
                const isChosen = chosen?.character.id === character.id && chosen.golden === isGolden;
                return (
                  <li
                    key={`${character.id}:${isGolden ? "golden" : "plain"}`}
                    className={`relative rounded-md ${isChosen ? "ring-4 ring-emerald-400" : ""}`}
                  >
                    <CharacterCard character={character} golden={isGolden} count={count} note={isGolden ? t("Doré", "Golden") : undefined} />
                    <button
                      type="button"
                      onClick={() => pick(character, isGolden)}
                      aria-pressed={isChosen}
                      aria-label={
                        isGolden
                          ? t(`Vendre ${character.name}, doré`, `Sell golden ${character.name}`)
                          : t(`Vendre ${character.name}`, `Sell ${character.name}`)
                      }
                      className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-straw"
                    />
                  </li>
                );
              })}
            </ul>
          </div>

          <form onSubmit={submit} className="space-y-3.5 rounded-[14px] border border-sea-700 bg-sea-800 p-4">
            <h3 className={LEGEND}>{t("2 · Son prix", "2 · Its price")}</h3>
            {!chosen || !bounds ? (
              <p className="text-sm text-mist">{t("Choisis d'abord l'avis à vendre.", "Pick the poster to sell first.")}</p>
            ) : (
              <>
                <p className="font-extrabold text-foam">
                  {chosen.character.name}
                  {golden && <span className="text-straw">{t(" · doré", " · golden")}</span>}{" "}
                  <span className="font-normal text-mist">· {RARITY_LABELS[locale][chosen.character.tier]}</span>
                </p>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-foam">
                    {t("Prix en Berrys", "Price in Berries")}{" "}
                    <span className="font-normal text-mist">
                      {t(
                        `de ${formatNumber(bounds.min, "fr")} à ${formatNumber(bounds.max, "fr")}`,
                        `${formatNumber(bounds.min, "en")} to ${formatNumber(bounds.max, "en")}`,
                      )}
                    </span>
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    min={bounds.min}
                    max={bounds.max}
                    step={PRICE_STEP}
                    required
                    className={`${FIELD} w-full`}
                  />
                </label>
                <p className="text-sm text-mist">
                  {valid
                    ? t(
                        `Taxe de ${Math.round(MARKET_TAX * 100)} % : tu toucheras ${formatNumber(marketProceeds(amount), "fr")} ฿ à la vente.`,
                        `${Math.round(MARKET_TAX * 100)}% tax: you'll get ${formatNumber(marketProceeds(amount), "en")} ฿ when it sells.`,
                      )
                    : t(
                        `Un prix dans la fourchette, par pas de ${PRICE_STEP} ฿.`,
                        `A price within the range, in steps of ${PRICE_STEP} ฿.`,
                      )}{" "}
                  {t(
                    "L'exemplaire quitte ta collection tant que l'annonce est ouverte ; il y revient si tu la retires.",
                    "The copy leaves your collection while the listing is open; it comes back if you take it down.",
                  )}
                </p>
                <Button type="submit" disabled={busy || !valid || full} className="min-h-12 w-full">
                  {t("Mettre en vente", "List for sale")}
                </Button>
                {full && (
                  <p className="text-sm font-semibold text-straw">
                    {t(
                      `Tu as déjà ${MARKET_MAX_LISTINGS} annonces ouvertes : retires-en une pour en ajouter.`,
                      `You already have ${MARKET_MAX_LISTINGS} open listings: take one down to add another.`,
                    )}
                  </p>
                )}
              </>
            )}
          </form>
        </div>
      )}
    </section>
  );
}

/** Une annonce : l'avis, son prix, et ce qu'on peut en faire. */
function Listing({ listing, data, action }: { listing: ListingView; data: ResolvedData; action: React.ReactNode }) {
  const t = useT();
  const locale = useLocale();
  return (
    <li className="flex flex-col gap-2">
      <CharacterCard
        character={data.characterById.get(listing.characterId) ?? null}
        golden={listing.golden}
        note={listing.mine ? t("Ton annonce", "Your listing") : listing.seller}
      />
      <p className="text-center font-display text-2xl leading-none tracking-wide text-straw">
        {formatNumber(listing.price, locale)} ฿
        {/* La ligne est réservée même pour un avis ordinaire : les boutons d'une rangée restent alignés */}
        <span className="block h-4 font-sans text-xs font-bold tracking-normal">{listing.golden && t("Avis doré", "Golden poster")}</span>
      </p>
      {action}
    </li>
  );
}

function Mine({ mine, data, busy, onCancel }: { mine: NonNullable<MarketOverview["mine"]>; data: ResolvedData; busy: boolean; onCancel: (id: string) => void }) {
  const t = useT();
  const locale = useLocale();
  // Les ventes sont vues dès qu'elles sont affichées : la cloche ne les compte plus
  const fresh = mine.sales.some((sale) => sale.fresh);
  useEffect(() => {
    if (fresh) void acknowledgeSalesAction().then(notificationsChanged, () => undefined);
  }, [fresh]);
  if (mine.active.length === 0 && mine.sales.length === 0) return null;

  return (
    <section aria-labelledby="mes-annonces" className="space-y-3.5">
      <h2 id="mes-annonces" className="text-xl font-extrabold text-foam">
        {t("Mes annonces", "My listings")} · {mine.active.length} / {MARKET_MAX_LISTINGS}
      </h2>
      {mine.active.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          {mine.active.map((listing) => (
            <Listing
              key={listing.id}
              listing={listing}
              data={data}
              action={
                <Button variant="secondary" disabled={busy} onClick={() => onCancel(listing.id)} className="py-1.5 text-sm">
                  {t("Retirer", "Take down")}
                </Button>
              }
            />
          ))}
        </ul>
      )}
      {mine.sales.length > 0 && (
        <ul className="space-y-2">
          {mine.sales.map((sale) => (
            <li
              key={sale.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-3 ${sale.fresh ? "border-straw/50 bg-straw/5" : "border-sea-700 bg-sea-800"}`}
            >
              <span className="min-w-0 flex-1 text-mist">
                <strong className="text-foam">
                  {data.characterById.get(sale.characterId)?.name ?? t("Un avis", "A poster")}
                  {sale.golden && t(" (doré)", " (golden)")}
                </strong>{" "}
                {sale.buyer ? t(`vendu à ${sale.buyer}`, `sold to ${sale.buyer}`) : t("vendu", "sold")}
              </span>
              <span className="font-extrabold text-emerald-300">+{formatNumber(sale.proceeds, locale)} ฿</span>
              <span className="text-sm text-mist">
                {t(`prix ${formatNumber(sale.price, "fr")} ฿, taxe déduite`, `price ${formatNumber(sale.price, "en")} ฿, after tax`)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Market({ data }: { data: ResolvedData }) {
  const { state, status, accountsEnabled, sync, refresh } = usePlayer();
  const t = useT();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<number | null>(null);
  const [sort, setSort] = useState<MarketSort>("recent");
  const [missingOnly, setMissingOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const isUser = status === "user";
  const { market, failed, reload } = useMarket({ mode: data.mode, lang: locale, tier, query, sort, missingOnly }, accountsEnabled);

  // La recherche part un instant après la dernière frappe, pas à chaque lettre
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function run(action: () => Promise<MarketResult>, success: string): Promise<boolean> {
    setBusy(true);
    const result = await action().catch((): MarketResult => ({ ok: false, error: "unavailable" }));
    setBusy(false);
    setMessage(result.ok ? { text: success, ok: true } : { text: MARKET_ERRORS[locale][result.error], ok: false });
    if (result.ok) sync(result.state);
    // Une annonce vendue entre-temps a pu changer le solde du joueur
    else refresh();
    reload();
    return result.ok;
  }

  const sortLabels: Record<MarketSort, string> = {
    recent: t("Les plus récentes", "Most recent"),
    cheap: t("Les moins chères", "Cheapest"),
    expensive: t("Les plus chères", "Most expensive"),
  };

  return (
    <div className="space-y-7">
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-display text-[40px] leading-none tracking-wide text-straw">฿ {formatNumber(state.berrys, locale)}</span>
        <span className="text-mist">
          {t(
            `Les joueurs y vendent leurs avis en trop. ${Math.round(MARKET_TAX * 100)} % du prix sont retenus à la vente.`,
            `Players sell their spare posters here. ${Math.round(MARKET_TAX * 100)}% of the price is withheld on each sale.`,
          )}
        </span>
      </p>
      <p className={`font-semibold empty:hidden ${message?.ok ? "text-emerald-300" : "text-vest"}`} aria-live="polite">
        {message?.text}
      </p>
      {/* Un compte qui n'a pas encore assez joué peut regarder le marché, mais ni vendre ni acheter */}
      {market?.access && !market.access.open && (
        <p className="rounded-xl border border-straw/50 bg-straw/5 px-4 py-3 font-semibold text-foam">{exchangeLockNote(market.access)[locale]}</p>
      )}

      {isUser && market?.mine && <Mine mine={market.mine} data={data} busy={busy} onCancel={(id) => run(() => cancelListingAction(id), t("Annonce retirée : l'avis est revenu dans ta collection.", "Listing taken down: the poster is back in your collection."))} />}

      <section aria-labelledby="annonces" className="space-y-3.5">
        <h2 id="annonces" className="text-xl font-extrabold text-foam">
          {t("Annonces", "Listings")}
          {market && <span className="font-normal text-mist"> · {market.total}</span>}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-48 flex-1">
            <span className="sr-only">{t("Chercher un personnage", "Search for a character")}</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={60}
              placeholder={t("Chercher un personnage", "Search for a character")}
              className={`${FIELD} w-full`}
            />
          </label>
          <label>
            <span className="sr-only">{t("Rareté", "Rarity")}</span>
            <select value={tier ?? ""} onChange={(event) => setTier(event.target.value ? Number(event.target.value) : null)} className={FIELD}>
              <option value="">{t("Toutes les raretés", "All rarities")}</option>
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  {RARITY_LABELS[locale][value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">{t("Tri", "Sort")}</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as MarketSort)} className={FIELD}>
              {MARKET_SORTS.map((value) => (
                <option key={value} value={value}>
                  {sortLabels[value]}
                </option>
              ))}
            </select>
          </label>
          {isUser && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-mist">
              <input type="checkbox" checked={missingOnly} onChange={(event) => setMissingOnly(event.target.checked)} className="size-[18px] accent-straw" />
              {t("Seulement les avis qui me manquent", "Only posters I'm missing")}
            </label>
          )}
        </div>

        {failed ? (
          <p className="font-semibold text-vest">{MARKET_ERRORS[locale].unavailable}</p>
        ) : !market ? (
          <LoadingPanel label={t("Chargement des annonces…", "Loading listings…")} />
        ) : market.listings.length === 0 ? (
          <Panel>
            <p className="text-mist">
              {query || tier !== null || missingOnly
                ? t("Aucune annonce ne correspond à ces filtres.", "No listings match these filters.")
                : t("Aucune annonce pour l'instant. Sois le premier à vendre un avis en trop.", "No listings yet. Be the first to sell a spare poster.")}
            </p>
          </Panel>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
              {market.listings.map((listing) => {
                const short = state.berrys < listing.price;
                return (
                  <Listing
                    key={listing.id}
                    listing={listing}
                    data={data}
                    action={
                      listing.mine ? (
                        <Button variant="secondary" disabled={busy} onClick={() => run(() => cancelListingAction(listing.id), t("Annonce retirée : l'avis est revenu dans ta collection.", "Listing taken down: the poster is back in your collection."))} className="py-1.5 text-sm">
                          {t("Retirer", "Take down")}
                        </Button>
                      ) : isUser ? (
                        <Button
                          disabled={busy || short}
                          onClick={() =>
                            run(
                              () => buyListingAction(listing.id),
                              t("Achat fait : l'avis a rejoint ta collection.", "Purchase done: the poster has joined your collection."),
                            )
                          }
                          className="py-1.5 text-sm"
                        >
                          {short ? t("Trop cher pour toi", "Can't afford it") : t("Acheter", "Buy")}
                        </Button>
                      ) : null
                    }
                  />
                );
              })}
            </ul>
            {market.total > market.listings.length && (
              <p className="text-sm text-mist">
                {t(
                  `${market.listings.length} annonces affichées sur ${market.total} : précise ta recherche pour voir les autres.`,
                  `Showing ${market.listings.length} of ${market.total} listings: narrow your search to see the rest.`,
                )}
              </p>
            )}
          </>
        )}
      </section>

      {isUser ? (
        <Sell
          data={data}
          open={market?.mine?.active.length ?? 0}
          busy={busy}
          onSell={(characterId, golden, price) =>
            run(() => createListingAction(characterId, golden, price), t("Annonce publiée.", "Listing published."))
          }
        />
      ) : (
        status === "guest" && (
          <Panel className="space-y-3">
            <p className="text-mist">
              {t(
                "Acheter et vendre se fait entre joueurs qui ont un compte.",
                "Buying and selling happens between players who have an account.",
              )}
            </p>
            <Link href="/profil#compte" className="inline-block rounded-lg bg-straw px-4 py-2.5 font-bold text-ink hover:bg-straw-dark">
              {t("Se connecter ou créer un compte", "Log in or create an account")}
            </Link>
          </Panel>
        )
      )}
    </div>
  );
}

export function MarketView() {
  const { status, accountsEnabled } = usePlayer();
  const t = useT();
  if (status === "loading") return <LoadingPanel />;
  if (!accountsEnabled) {
    return (
      <Panel>
        <p className="text-mist">{t("Le marché n'est pas disponible pour l'instant.", "The market isn't available right now.")}</p>
      </Panel>
    );
  }
  return <WithGameData loading={t("Chargement du marché…", "Loading the market…")}>{({ data }) => <Market data={data} />}</WithGameData>;
}
