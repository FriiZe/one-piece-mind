"use client";

import Link from "@/components/Link";
import { useEffect, useMemo, useState } from "react";
import { formatBounty, formatNumber } from "@/games/engine/text";
import { Button, Panel } from "@/games/ui/primitives";
import { LoadingPanel, WithGameData } from "@/games/ui/WithGameData";
import type { ResolvedData } from "@/games/cards";
import { formatDate } from "@/lib/admin/format";
import { playerBounty, POST_IDS, POSTS, rankOf } from "@/lib/economy";
import { useLocale, useT } from "@/lib/i18n/client";
import { FRIEND_ERRORS, type FriendResult } from "@/lib/multi/friends";
import { answerFriendRequestAction, cancelFriendRequestAction, requestFriendAction } from "@/lib/player/friend-actions";
import { usePlayer } from "@/lib/player/PlayerProvider";
import type { PlayerProfile } from "@/lib/players/types";
import { leagueOf } from "@/lib/ranked/rules";
import type { SpoilerMode } from "@/lib/spoilers";
import { CharacterCard } from "./CharacterCard";
import { ShipArt, useCosmeticName } from "./Cosmetics";

/** Page publique d'un joueur ; `null` pendant le chargement, `"missing"` s'il n'existe pas. */
function useProfile(username: string, mode: SpoilerMode): { profile: PlayerProfile | "missing" | null; reload: () => void } {
  const [loaded, setLoaded] = useState<{ key: string; profile: PlayerProfile | "missing" } | null>(null);
  const [kick, setKick] = useState(0);
  const key = `${username}:${mode}:${kick}`;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/players/${encodeURIComponent(username)}?mode=${mode}`, { cache: "no-store" })
      .then((response): Promise<PlayerProfile | "missing"> => (response.ok ? response.json() : Promise.resolve("missing")))
      .catch((): "missing" => "missing")
      .then((profile) => {
        if (!cancelled) setLoaded({ key, profile });
      });
    return () => {
      cancelled = true;
    };
  }, [username, mode, key]);
  return { profile: loaded?.key === key ? loaded.profile : null, reload: () => setKick((value) => value + 1) };
}

/** Le lien d'amitié avec ce joueur, et de quoi le nouer. */
function FriendButton({ profile, onChanged }: { profile: PlayerProfile; onChanged: () => void }) {
  const t = useT();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<FriendResult>, success: string) {
    setBusy(true);
    const result = await action().catch((): FriendResult => ({ ok: false, error: "unavailable" }));
    setBusy(false);
    setMessage(result.ok ? success : FRIEND_ERRORS[locale][result.error]);
    if (result.ok) onChanged();
  }

  const content = (() => {
    switch (profile.friendship) {
      case "self":
        return (
          <Link href="/profil" className="font-bold text-straw underline underline-offset-4">
            {t("C'est toi : voir mon profil", "That's you: see my profile")}
          </Link>
        );
      case "guest":
        return (
          <Link href="/profil" className="font-bold text-straw underline underline-offset-4">
            {t("Se connecter pour l'ajouter en ami", "Log in to add them as a friend")}
          </Link>
        );
      case "friends":
        return (
          <span className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-emerald-600/20 px-3 py-1 text-sm font-extrabold text-emerald-300">{t("Vous êtes amis", "You're friends")}</span>
            <Link href="/echanges" className="text-sm font-bold text-straw underline underline-offset-4">
              {t("Lui proposer un échange", "Offer them a trade")}
            </Link>
          </span>
        );
      case "sent":
        return (
          <span className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-mist">{t("Demande d'ami envoyée", "Friend request sent")}</span>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => run(() => cancelFriendRequestAction(profile.requestId!), t("Demande retirée.", "Request withdrawn."))}
            >
              {t("Retirer", "Withdraw")}
            </Button>
          </span>
        );
      case "received":
        return (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-mist">{t("Ce joueur t'a demandé en ami.", "This player sent you a friend request.")}</span>
            <Button disabled={busy} onClick={() => run(() => answerFriendRequestAction(profile.requestId!, true), t("Vous êtes amis.", "You're now friends."))}>
              {t("Accepter", "Accept")}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => run(() => answerFriendRequestAction(profile.requestId!, false), t("Demande refusée.", "Request declined."))}>
              {t("Refuser", "Decline")}
            </Button>
          </span>
        );
      default:
        return (
          <Button disabled={busy} onClick={() => run(() => requestFriendAction(profile.username), t("Demande envoyée.", "Request sent."))}>
            {t("Ajouter en ami", "Add as a friend")}
          </Button>
        );
    }
  })();

  return (
    <div className="space-y-2">
      {content}
      {message && (
        <p className="text-sm font-semibold text-foam" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}

function Profile({ username, data, mode }: { username: string; data: ResolvedData; mode: SpoilerMode }) {
  const t = useT();
  const locale = useLocale();
  const { status } = usePlayer();
  const { profile, reload } = useProfile(username, mode);
  const cosmeticName = useCosmeticName();
  const collection = useMemo(
    () =>
      profile && profile !== "missing"
        ? data.characters.filter((c) => profile.collection[c.id]).sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name, locale))
        : [],
    [profile, data.characters, locale],
  );

  if (profile === null || status === "loading") return <LoadingPanel label={t("Chargement du joueur…", "Loading the player…")} />;
  if (profile === "missing") {
    return (
      <Panel className="space-y-3">
        <p className="text-mist">{t(`Aucun joueur ne s'appelle « ${username} ».`, `No player goes by “${username}”.`)}</p>
        <Link href="/classement" className="inline-block font-bold text-straw underline underline-offset-4">
          {t("Voir le classement", "See the leaderboard")}
        </Link>
      </Panel>
    );
  }

  const bounty = playerBounty(profile);
  const rank = rankOf(bounty);
  const title = cosmeticName(profile.look.title);
  const filled = POST_IDS.filter((post) => profile.crew[post]);
  const golden = collection.filter((c) => profile.collection[c.id].golden > 0).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-end gap-3">
          <ShipArt id={profile.look.ship} flag={profile.look.flag} className="h-[60px] w-20" />
          <div>
            <h1 className="font-display text-4xl tracking-wide text-foam sm:text-[40px]">{profile.username}</h1>
            <p className="text-sm text-mist">
              {title ? `${title} · ` : ""}
              {t(`membre depuis le ${formatDate(new Date(profile.createdAt), locale)}`, `member since ${formatDate(new Date(profile.createdAt), locale)}`)}
            </p>
          </div>
        </div>
        <FriendButton profile={profile} onChanged={reload} />
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("Prime", "Bounty"), value: formatBounty(bounty, locale), hint: rank.title[locale] },
          { label: t("Parties", "Games"), value: formatNumber(profile.games, locale), hint: null },
          {
            label: t("Classé", "Ranked"),
            value: profile.rating === null ? "—" : formatNumber(profile.rating, locale),
            hint: profile.rating === null ? t("pas cette saison", "not this season") : leagueOf(profile.rating).league.title[locale],
          },
          {
            label: t("Collection", "Collection"),
            value: `${collection.length} / ${profile.known}`,
            hint: golden > 0 ? t(`dont ${golden} doré${golden > 1 ? "s" : ""}`, `including ${golden} golden`) : null,
          },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse rounded-2xl border border-sea-700 p-4">
            <dt className="text-[13px] text-mist">{stat.label}</dt>
            <dd>
              <span className="block font-display text-2xl tracking-wide text-straw">{stat.value}</span>
              {stat.hint && <span className="block text-xs text-mist">{stat.hint}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="equipage-joueur" className="space-y-3">
        <h2 id="equipage-joueur" className="text-xl font-extrabold text-foam">
          {t("Son équipage", "Their crew")}{" "}
          <span className="text-base font-semibold text-mist">
            · {filled.length} {t("sur", "of")} {POST_IDS.length} {t("postes", "posts")}
          </span>
        </h2>
        {filled.length === 0 ? (
          <p className="text-sm text-mist">{t("Aucun poste pourvu pour l'instant.", "No post filled yet.")}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {filled.map((post) => {
              const member = data.characterById.get(profile.crew[post]!) ?? null;
              return (
                <li key={post}>
                  <CharacterCard character={member} golden={!!member && profile.collection[member.id]?.golden > 0} note={POSTS[post].label[locale]} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="collection-joueur" className="space-y-3">
        <h2 id="collection-joueur" className="text-xl font-extrabold text-foam">
          {t("Sa collection", "Their collection")}
        </h2>
        {collection.length === 0 ? (
          <p className="text-sm text-mist">{t("Aucun avis de recherche pour l'instant.", "No wanted posters yet.")}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {collection.map((character) => {
              const entry = profile.collection[character.id];
              return (
                <li key={character.id}>
                  <CharacterCard character={character} golden={entry.golden > 0} count={entry.count} />
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-mist">
          {t(
            "Tu ne vois ici que les personnages que ton mode spoiler te montre.",
            "You only see the characters your spoiler mode shows you.",
          )}
        </p>
      </section>
    </div>
  );
}

export function PlayerProfileView({ username }: { username: string }) {
  const t = useT();
  return (
    <WithGameData loading={t("Chargement du joueur…", "Loading the player…")}>
      {({ data, mode }) => <Profile username={username} data={data} mode={mode ?? "anime"} />}
    </WithGameData>
  );
}
