"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { portraitUrl, type ResolvedData } from "@/games/cards";
import { formatNumber } from "@/games/engine/text";
import { Button, Panel } from "@/games/ui/primitives";
import { WithGameData } from "@/games/ui/WithGameData";
import {
  crewBonuses,
  DEFAULT_TRAIT,
  bonusLabel,
  FULL_CREW_BONUS,
  playerBounty,
  POST_IDS,
  POSTS,
  postStrength,
  rankOf,
  RARITY_LABELS,
  TRAIT_STEPS,
  TRAITS,
  type CrewTrait,
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

/** Paliers d'un trait : ceux déjà atteints sont allumés. */
function Steps({ trait }: { trait: CrewTrait }) {
  return (
    <span className="flex shrink-0 gap-1" aria-label={`Palier ${trait.level} sur ${TRAIT_STEPS.length}`}>
      {TRAIT_STEPS.map((step, index) => (
        <span
          key={step}
          className={`flex size-7 items-center justify-center rounded-full border text-xs font-bold ${
            index < trait.level ? "border-straw bg-straw text-ink" : "border-sea-600 text-mist"
          }`}
        >
          {step}
        </span>
      ))}
    </span>
  );
}

/** Traits d'équipage : les membres d'une même affiliation renforcent ensemble un bonus, par paliers. */
function Traits({ traits, full }: { traits: CrewTrait[]; full: boolean }) {
  return (
    <Panel className="space-y-3">
      <div>
        <h3 className="font-display text-2xl tracking-wide text-straw">Traits d&apos;équipage</h3>
        <p className="text-sm text-mist">
          Place plusieurs membres d&apos;une même affiliation : à {TRAIT_STEPS[0]} membres leur trait s&apos;active, puis il se
          renforce à {TRAIT_STEPS.slice(1).join(" et ")}. Plusieurs traits peuvent être actifs en même temps.
        </p>
      </div>

      {traits.length === 0 ? (
        <p className="text-sm text-mist">Aucun membre d&apos;équipage n&apos;a d&apos;affiliation pour l&apos;instant.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {traits.map((trait) => {
            const next = TRAIT_STEPS[trait.level];
            return (
              <li
                key={trait.affiliation}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  trait.level > 0 ? "border-straw/60 bg-straw/10" : "border-sea-700 bg-sea-900/40"
                }`}
              >
                <Steps trait={trait} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-bold text-foam">
                    {trait.name}
                    {trait.level > 0 && <span className="ml-2 font-display text-lg tracking-wide text-straw">{percent(trait.value)}</span>}
                  </p>
                  <p className="truncate text-mist">
                    {trait.affiliation} · {trait.count} membre{trait.count > 1 ? "s" : ""}
                  </p>
                  <p className="text-mist">
                    {trait.effect}
                    {next !== undefined && ` · à ${next} : ${percent(trait.values[trait.level])}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-sm text-mist">
        {full ? "Équipage complet : " : "Les dix postes pourvus : "}
        {percent(FULL_CREW_BONUS)} de Berrys sur tous les jeux.
      </p>

      <details className="text-sm text-mist">
        <summary className="cursor-pointer font-semibold text-foam">Tous les traits</summary>
        <ul className="mt-2 space-y-1">
          {[...Object.entries(TRAITS), ["Toute autre affiliation", DEFAULT_TRAIT] as const].map(([affiliation, trait]) => (
            <li key={affiliation}>
              <strong className="text-foam">{trait.name}</strong> ({affiliation}) : {bonusLabel(trait.bonus).toLowerCase()},{" "}
              {trait.values.map(percent).join(" / ")}
            </li>
          ))}
        </ul>
      </details>
    </Panel>
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
  const aboard = new Map(bonuses.traits.map((trait) => [trait.affiliation, trait.count]));

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
          encore. Et des membres d&apos;une même affiliation activent ensemble un trait.
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
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  {/* Pour composer un trait : l'affiliation, et le nombre de ses membres déjà à bord */}
                  {character.affiliation && (
                    <p className="mt-1 truncate text-center text-xs text-mist" title={character.affiliation}>
                      {character.affiliation}
                      {aboard.get(character.affiliation) ? ` · ${aboard.get(character.affiliation)} à bord` : ""}
                    </p>
                  )}
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

      <Traits traits={bonuses.traits} full={bonuses.full} />
    </section>
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

  return (
    <div className="space-y-8">
      {/* Un invité vient d'abord ici pour se connecter ou créer son compte */}
      {status === "guest" && <AccountPanel />}
      <Bounty />
      <WithGameData loading="Chargement de l'équipage…">{({ data }) => <Crew data={data} />}</WithGameData>
      <FriendsPanel />
      {status === "user" && <AccountPanel />}
    </div>
  );
}
