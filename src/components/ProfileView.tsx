"use client";

import Link from "next/link";
import { useEffect } from "react";
import { formatNumber } from "@/games/engine/text";
import { LoadingPanel } from "@/games/ui/WithGameData";
import { isMet, OBJECTIVES, playerBounty, POST_IDS, RANKS, rankOf, SIGNUP_BERRYS } from "@/lib/economy";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { AccountPanel } from "./AccountPanel";
import { FriendsPanel } from "./FriendsPanel";
import { CheckIcon } from "./GameBadge";

/** L'avis de recherche du joueur : sa prime, son rang et son parcours. */
function Poster() {
  const { state, username } = usePlayer();
  const bounty = playerBounty(state);
  const rank = rankOf(bounty);
  const from = RANKS.find((r) => r.title === rank.title)?.from ?? 0;
  const progress = rank.next ? Math.min(1, (bounty - from) / (rank.next.from - from)) : 1;
  const objectives = Object.values(state.stats).reduce(
    (sum, stats) => sum + OBJECTIVES.filter((objective) => isMet(objective, stats)).length,
    0,
  );
  const stats = [
    { label: "parties", value: state.games },
    { label: "avis recrutés", value: Object.keys(state.collection).length },
    { label: "objectifs", value: objectives },
  ];

  return (
    <section aria-label="Mon avis de recherche" className="rounded-xl border-4 border-parchment-dark bg-parchment p-6 text-center text-ink sm:p-7">
      <p className="font-display text-5xl leading-none tracking-[0.2em] sm:text-[52px]" aria-hidden="true">
        WANTED
      </p>
      <div className="mt-4 flex h-44 items-center justify-center bg-[#d9c9a0] font-display text-7xl text-[#a8966a] sm:h-[200px]" aria-hidden="true">
        {username ? username.charAt(0).toLocaleUpperCase("fr") : "?"}
      </div>
      <p className="mt-3 text-xs font-extrabold tracking-[0.3em]" aria-hidden="true">
        DEAD OR ALIVE
      </p>
      <p className="mt-1 truncate font-display text-4xl tracking-wide sm:text-[40px]">{username ?? "Pirate anonyme"}</p>
      <p className="font-display text-3xl tracking-wide sm:text-[34px]">฿ {formatNumber(bounty)}</p>

      <div className="mt-4 space-y-1.5">
        <p className="flex justify-between gap-3 text-sm font-bold">
          <span>{rank.title}</span>
          <span>{rank.next ? `${rank.next.title} à ${formatNumber(rank.next.from)} ฿` : "Rang le plus élevé"}</span>
        </p>
        <div
          role="progressbar"
          aria-label="Progression vers le rang suivant"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-2.5 overflow-hidden rounded-full bg-parchment-dark"
        >
          <div className="h-full bg-ink" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse">
            <dt className="text-[13px]">{stat.label}</dt>
            <dd className="font-display text-[26px] tracking-wide">{formatNumber(stat.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[13px]">Ta prime monte avec tous les Berrys que tu gagnes, même une fois dépensés.</p>
    </section>
  );
}

function ShipLink() {
  const { state } = usePlayer();
  const filled = POST_IDS.filter((post) => state.crew[post]).length;
  return (
    <Link
      href="/navire"
      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sea-700 px-5 py-4 font-bold text-foam transition-colors hover:border-straw"
    >
      <span>Mon navire : équipage, collection, boutique, échanges</span>
      <span className="text-sm text-mist">
        {filled} poste{filled > 1 ? "s" : ""} pourvu{filled > 1 ? "s" : ""} sur {POST_IDS.length}
      </span>
    </Link>
  );
}

const BENEFITS = [
  { key: "berrys", text: <><strong>{formatNumber(SIGNUP_BERRYS)} ฿ offerts</strong> dès l&apos;inscription</> },
  { key: "appareils", text: <>Ta collection sur <strong>tous tes appareils</strong></> },
  { key: "amis", text: <>Des <strong>amis</strong>, des échanges d&apos;avis et des salons à plusieurs</> },
  { key: "quiz", text: <>Tes propres <strong>quiz</strong>, joués par la commu</> },
];

/** Le visiteur sans compte : ce qu'il a déjà gagné sur cet appareil, et ce qu'un compte lui apporte. */
function GuestProfile() {
  const { state, accountsEnabled } = usePlayer();
  const owned = Object.keys(state.collection).length;

  return (
    <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start lg:gap-x-16 lg:pt-6">
      <div>
        <h1 className="font-display text-4xl leading-[1.05] tracking-wide text-foam sm:text-[52px]">
          Monte à bord,
          <br />
          garde ton butin
        </h1>
        <p className="mt-3 max-w-xl text-lg text-mist">
          Tu joues déjà sans compte. Avec un pseudo, tes Berrys et ton équipage te suivent partout.
        </p>
      </div>

      {/* Sur téléphone, le formulaire vient juste après l'accroche ; sur ordinateur, il occupe la colonne de droite */}
      <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <AccountPanel />
      </div>

      <section aria-label="Ce qu'apporte un compte" className="space-y-7">
        <div className="flex items-center gap-5 rounded-2xl border border-sea-700 bg-sea-800 p-5">
          <div className="w-[104px] shrink-0 overflow-hidden rounded-lg border-4 border-parchment-dark bg-parchment text-center text-ink" aria-hidden="true">
            <p className="pt-1.5 font-display tracking-[0.2em]">Wanted</p>
            <p className="mx-2 my-1 flex h-20 items-center justify-center bg-[#d9c9a0] font-display text-5xl text-[#a8966a]">?</p>
            <p className="px-1 pb-2 font-display text-sm">Pirate anonyme</p>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-[17px] font-extrabold text-foam">Ta progression sur cet appareil</h2>
            <p className="text-[15px] text-mist">
              {formatNumber(state.games)} partie{state.games > 1 ? "s" : ""} · {formatNumber(state.berrys)} ฿ · {owned} avis de recherche
            </p>
            {accountsEnabled && <p className="text-[15px] font-bold text-emerald-300">Elle est reprise telle quelle à la création du compte.</p>}
          </div>
        </div>

        {accountsEnabled && (
          <ul className="space-y-3.5">
            {BENEFITS.map((benefit, index) => (
              <li key={benefit.key} className="flex items-center gap-3 text-foam [&_strong]:font-extrabold">
                <span
                  aria-hidden="true"
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full font-display text-lg ${
                    index === 0 ? "bg-straw/20 text-straw" : "bg-sea-700 text-[#8fd0f0]"
                  }`}
                >
                  {index === 0 ? "฿" : <CheckIcon />}
                </span>
                <span>{benefit.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ProfileView() {
  const { status } = usePlayer();

  // Les rubriques n'apparaissent qu'une fois le joueur reconnu : un lien vers « #amis » ou « #compte » est suivi à ce moment-là
  useEffect(() => {
    if (status === "loading") return;
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, [status]);

  if (status === "loading") return <LoadingPanel label="Chargement du profil…" />;
  if (status === "guest") return <GuestProfile />;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start">
      <h1 className="sr-only">Mon profil</h1>
      <Poster />
      <div className="space-y-5">
        <FriendsPanel />
        <AccountPanel />
        <ShipLink />
      </div>
    </div>
  );
}
