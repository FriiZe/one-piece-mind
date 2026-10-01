"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ResolvedData } from "@/games/cards";
import { formatNumber } from "@/games/engine/text";
import { Panel } from "@/games/ui/primitives";
import { WithGameData } from "@/games/ui/WithGameData";
import {
  AFFILIATION_SYNERGY,
  crewBonuses,
  FULL_CREW_BONUS,
  playerBounty,
  POST_IDS,
  POSTS,
  postStrength,
  rankOf,
  RARITY_LABELS,
  type PostId,
} from "@/lib/economy";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { AccountPanel } from "./AccountPanel";

const percent = (value: number) => `+${Math.round(value * 100)} %`;

function Bounty() {
  const { state, username } = usePlayer();
  const bounty = playerBounty(state);
  const rank = rankOf(bounty);
  const owned = Object.keys(state.collection).length;

  return (
    <div className="rounded-2xl bg-parchment p-5 text-ink sm:p-6">
      <p className="text-sm font-bold tracking-[0.25em] uppercase">{username ?? "Pirate anonyme"}</p>
      <p className="font-display text-5xl tracking-wide">฿ {formatNumber(bounty)}</p>
      <p className="mt-1 font-semibold">
        Rang : {rank.title}
        {rank.next && ` · ${rank.next.title} à ${formatNumber(rank.next.from)} ฿ de prime`}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Berrys", value: state.berrys },
          { label: "Parties", value: state.games },
          { label: "Avis recrutés", value: owned },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse rounded-xl border-2 border-ink/15 bg-white/50 px-2 py-3">
            <dt className="text-sm">{stat.label}</dt>
            <dd className="font-display text-3xl tracking-wide">{formatNumber(stat.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm">Ta prime monte avec tous les Berrys que tu gagnes, même une fois dépensés.</p>
    </div>
  );
}

function Crew({ data }: { data: ResolvedData }) {
  const { state, assign } = usePlayer();
  const [error, setError] = useState<string | null>(null);

  const owned = useMemo(
    () =>
      data.characters
        .filter((c) => state.collection[c.id])
        .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name, "fr")),
    [data.characters, state.collection],
  );
  const bonuses = crewBonuses(state, data.characterById);

  async function change(post: PostId, value: string) {
    setError(null);
    const result = await assign(post, value || null);
    if (!result.ok) setError("Ce changement n'a pas pu être enregistré.");
  }

  return (
    <section aria-labelledby="equipage" className="space-y-4">
      <div>
        <h2 id="equipage" className="font-display text-3xl tracking-wide text-straw">
          Mon équipage
        </h2>
        <p className="mt-1 text-mist">
          Chaque poste donne un bonus, d&apos;autant plus fort que le personnage est rare. Un avis doré le renforce
          encore.
        </p>
      </div>

      {owned.length === 0 ? (
        <Panel>
          <p className="text-mist">Tu n&apos;as encore recruté personne. Joue une partie pour commencer ta collection.</p>
          <Link href="/jeux" className="mt-3 inline-block font-bold text-straw underline underline-offset-4">
            Choisir un jeu
          </Link>
        </Panel>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {POST_IDS.map((post) => {
            const memberId = state.crew[post];
            const member = memberId ? data.characterById.get(memberId) : undefined;
            return (
              <li key={post} className="rounded-xl border border-sea-700 bg-sea-800/70 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-bold text-foam">{POSTS[post].label}</h3>
                  {member && (
                    <span className="font-display text-xl tracking-wide text-straw">
                      {percent(postStrength(member, state.collection[member.id], post))}
                    </span>
                  )}
                </div>
                <p className="text-sm text-mist">{POSTS[post].effect}</p>
                <label className="mt-2 block">
                  <span className="sr-only">Personnage au poste de {POSTS[post].label}</span>
                  <select
                    value={member ? member.id : ""}
                    onChange={(event) => change(post, event.target.value)}
                    className="w-full rounded-lg border-2 border-sea-600 bg-sea-900 px-3 py-2 text-foam focus:border-straw focus:outline-none"
                  >
                    <option value="">Poste libre</option>
                    {owned.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.name} · {RARITY_LABELS[character.tier]}
                        {state.collection[character.id].golden > 0 ? " · doré" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="font-semibold text-vest">
          {error}
        </p>
      )}

      <Panel className="space-y-1 text-sm text-mist">
        <p className="font-bold text-foam">Bonus d&apos;ensemble</p>
        <p>
          {bonuses.sharedAffiliation
            ? `Esprit d'équipage (${bonuses.sharedAffiliation}) : ${percent(AFFILIATION_SYNERGY.bonus)} de Berrys sur tous les jeux.`
            : `${AFFILIATION_SYNERGY.members} membres de la même affiliation : ${percent(AFFILIATION_SYNERGY.bonus)} de Berrys sur tous les jeux.`}
        </p>
        <p>
          {bonuses.full ? "Équipage complet : " : "Les dix postes pourvus : "}
          {percent(FULL_CREW_BONUS)} de Berrys sur tous les jeux.
        </p>
      </Panel>
    </section>
  );
}

export function ProfileView() {
  return (
    <div className="space-y-8">
      <Bounty />
      <WithGameData loading="Chargement de l'équipage…">{({ data }) => <Crew data={data} />}</WithGameData>
      <AccountPanel />
    </div>
  );
}
