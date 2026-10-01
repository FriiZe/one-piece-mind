"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { portraitUrl, type ResolvedData } from "@/games/cards";
import { formatNumber } from "@/games/engine/text";
import { Button, Panel } from "@/games/ui/primitives";
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
import { CharacterCard } from "./CharacterCard";
import { FriendsPanel } from "./FriendsPanel";
import { Modal } from "./Modal";

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
      <p className="mt-3 text-sm">
        Ta prime monte avec tous les Berrys que tu gagnes, même une fois dépensés.{" "}
        <Link href="/collection" className="font-semibold underline underline-offset-4">
          Voir ma collection
        </Link>
      </p>
    </div>
  );
}

function Crew({ data }: { data: ResolvedData }) {
  const { state, assign } = usePlayer();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<PostId | null>(null);

  const owned = useMemo(
    () =>
      data.characters
        .filter((c) => state.collection[c.id])
        .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name, "fr")),
    [data.characters, state.collection],
  );
  const bonuses = crewBonuses(state, data.characterById);
  const postOf = (characterId: string) => POST_IDS.find((post) => state.crew[post] === characterId);

  async function change(post: PostId, characterId: string | null) {
    setError(null);
    setPicking(null);
    const result = await assign(post, characterId);
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
            const golden = !!member && state.collection[member.id]?.golden > 0;
            return (
              <li key={post} className="flex gap-3 rounded-xl border border-sea-700 bg-sea-800/70 p-3">
                <div
                  className={`relative h-28 w-21 shrink-0 overflow-hidden rounded-lg border-2 bg-sea-900 ${
                    golden ? "border-straw" : "border-sea-600"
                  }`}
                >
                  {member?.img ? (
                    <Image src={portraitUrl(member.img)} alt="" fill sizes="96px" className="object-cover object-top" />
                  ) : (
                    <span className="flex h-full items-center justify-center font-display text-4xl text-mist/50" aria-hidden="true">
                      {member ? member.name.charAt(0) : "?"}
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-bold text-foam">{POSTS[post].label}</h3>
                    {member && (
                      <span className="font-display text-xl tracking-wide text-straw">
                        {percent(postStrength(member, state.collection[member.id], post))}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-mist">{POSTS[post].effect}</p>
                  <p className="mt-1 truncate font-semibold text-foam">
                    {member ? (
                      <>
                        {member.name}
                        <span className="font-normal text-mist">
                          {" "}
                          · {RARITY_LABELS[member.tier]}
                          {golden ? " · doré" : ""}
                        </span>
                      </>
                    ) : (
                      <span className="font-normal text-mist">Poste libre</span>
                    )}
                  </p>
                  <div className="mt-auto pt-2">
                    <button
                      type="button"
                      onClick={() => setPicking(post)}
                      aria-label={`${member ? "Changer" : "Choisir"} le personnage au poste de ${POSTS[post].label}`}
                      className="rounded-lg border border-sea-600 bg-sea-700 px-3 py-1.5 text-sm font-bold text-foam hover:bg-sea-600"
                    >
                      {member ? "Changer" : "Choisir"}
                    </button>
                  </div>
                </div>
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

      {picking && (
        <Modal title={POSTS[picking].label} onClose={() => setPicking(null)} wide>
          <p className="text-mist">
            {POSTS[picking].effect}. Choisis le personnage qui tiendra ce poste ; s&apos;il en occupe déjà un autre, il
            le quitte.
          </p>
          {state.crew[picking] && (
            <Button variant="secondary" onClick={() => change(picking, null)}>
              Libérer le poste
            </Button>
          )}
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {owned.map((character) => {
              const entry = state.collection[character.id];
              const current = state.crew[picking] === character.id;
              const other = postOf(character.id);
              return (
                <li key={character.id} className={`relative rounded-md ${current ? "ring-4 ring-emerald-400" : ""}`}>
                  <CharacterCard
                    character={character}
                    golden={entry.golden > 0}
                    note={`${percent(postStrength(character, entry, picking))}${
                      current ? " · en poste" : other ? ` · ${POSTS[other].label}` : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => change(picking, character.id)}
                    aria-label={`Placer ${character.name} au poste de ${POSTS[picking].label}`}
                    aria-pressed={current}
                    className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-straw"
                  />
                </li>
              );
            })}
          </ul>
        </Modal>
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
      <FriendsPanel />
      <AccountPanel />
    </div>
  );
}
