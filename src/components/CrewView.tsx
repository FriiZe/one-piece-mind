"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { portraitUrl, type ResolvedData } from "@/games/cards";
import { Button, Panel } from "@/games/ui/primitives";
import { WithGameData } from "@/games/ui/WithGameData";
import {
  bonusLabel,
  crewBonuses,
  DEFAULT_TRAIT,
  FULL_CREW_BONUS,
  POST_IDS,
  POSTS,
  postStrength,
  TRAIT_STEPS,
  TRAITS,
  type CrewBonuses,
  type CrewTrait,
  type PostId,
} from "@/lib/economy";
import { GAME_CATEGORIES } from "@/lib/games/catalog";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { CharacterCard } from "./CharacterCard";
import { Modal } from "./Modal";

const percent = (value: number) => `+${Math.round(value * 100)} %`;

/** Tous les bonus de l'équipage, postes et traits confondus, du plus général au plus particulier. */
function bonusLines(bonuses: CrewBonuses): { label: string; value: number }[] {
  return [
    { label: "Berrys sur tous les jeux", value: bonuses.berrys.all ?? 0 },
    { label: "Berrys sur le défi du jour", value: bonuses.berrys.daily ?? 0 },
    ...GAME_CATEGORIES.map((category) => ({ label: `Berrys « ${category.title} »`, value: bonuses.berrys[category.id] ?? 0 })),
    { label: "Chances de recruter", value: bonuses.recruit },
    { label: "Chances d'avis doré", value: bonuses.golden },
    { label: "Réduction à la boutique", value: bonuses.discount },
  ].filter((line) => line.value > 0);
}

function Summary({ bonuses }: { bonuses: CrewBonuses }) {
  const lines = bonusLines(bonuses);
  return (
    <section aria-labelledby="bonus" className="space-y-2.5 rounded-2xl border border-straw/50 bg-straw/5 p-5">
      <h2 id="bonus" className="font-extrabold text-foam">
        Ce que rapporte ton équipage
      </h2>
      {lines.length === 0 ? (
        <p className="text-sm text-mist">Aucun bonus pour l&apos;instant : place une recrue à un poste.</p>
      ) : (
        <dl className="space-y-1.5">
          {lines.map((line) => (
            <div key={line.label} className="flex items-baseline justify-between gap-3 text-[15px]">
              <dt className="text-mist">{line.label}</dt>
              <dd className="font-display text-xl tracking-wide text-straw">{percent(line.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/** Traits d'équipage : les membres d'une même affiliation renforcent ensemble un bonus, par paliers. */
function Traits({ traits }: { traits: CrewTrait[] }) {
  return (
    <section aria-labelledby="traits" className="space-y-4 rounded-2xl border border-sea-700 p-5">
      <div>
        <h2 id="traits" className="font-extrabold text-foam">
          Traits d&apos;équipage
        </h2>
        <p className="mt-1 text-sm text-mist">
          {TRAIT_STEPS[0]} membres d&apos;une même affiliation activent son trait ; il se renforce à {TRAIT_STEPS.slice(1).join(" et ")}.
        </p>
      </div>

      {traits.length === 0 ? (
        <p className="text-sm text-mist">Aucun membre d&apos;équipage n&apos;a d&apos;affiliation pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-4">
          {traits.map((trait) => {
            const next = TRAIT_STEPS[trait.level];
            return (
              <li key={trait.affiliation} className="space-y-1.5">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="font-bold text-foam">{trait.name}</span>
                  {trait.level > 0 ? (
                    <span className="font-display text-xl tracking-wide text-straw">{percent(trait.value)}</span>
                  ) : (
                    <span className="text-[13px] text-mist">inactif</span>
                  )}
                </p>
                <span className="flex gap-1.5" role="img" aria-label={`Palier ${trait.level} sur ${TRAIT_STEPS.length}`}>
                  {TRAIT_STEPS.map((step, index) => (
                    <span key={step} className={`h-2 flex-1 rounded-full ${index < trait.level ? "bg-straw" : "bg-sea-700"}`} />
                  ))}
                </span>
                <p className="text-[13px] text-mist">
                  {trait.count} membre{trait.count > 1 ? "s" : ""} · {trait.affiliation}
                  {next !== undefined
                    ? ` · encore ${next - trait.count} pour ${percent(trait.values[trait.level])} (${trait.effect.toLowerCase()})`
                    : ` · ${trait.effect.toLowerCase()}, palier maximal`}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <details className="text-sm text-mist">
        <summary className="cursor-pointer font-bold text-foam underline underline-offset-4">Voir tous les traits</summary>
        <ul className="mt-2 space-y-1.5">
          {[...Object.entries(TRAITS), ["Toute autre affiliation", DEFAULT_TRAIT] as const].map(([affiliation, trait]) => (
            <li key={affiliation}>
              <strong className="text-foam">{trait.name}</strong> ({affiliation}) : {bonusLabel(trait.bonus).toLowerCase()},{" "}
              {trait.values.map(percent).join(" / ")}
            </li>
          ))}
        </ul>
      </details>
    </section>
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
  const free = POST_IDS.filter((post) => !state.crew[post] || !data.characterById.get(state.crew[post]!)).length;

  async function change(post: PostId, characterId: string | null) {
    setError(null);
    setPicking(null);
    const result = await assign(post, characterId);
    if (!result.ok) setError("Ce changement n'a pas pu être enregistré.");
  }

  if (owned.length === 0) {
    return (
      <Panel>
        <p className="text-mist">
          Tu n&apos;as encore recruté personne. Valide un jeu du jour, ou passe à la boutique, pour accueillir ta première recrue : tu pourras
          ensuite lui confier un poste.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-bold">
          <Link href="/" className="text-straw underline underline-offset-4">
            Voir les jeux du jour
          </Link>
          <Link href="/boutique" className="text-straw underline underline-offset-4">
            Aller à la boutique
          </Link>
        </p>
      </Panel>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="postes" className="space-y-3">
        <h2 id="postes" className="sr-only">
          Les dix postes
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
          {POST_IDS.map((post) => {
            const memberId = state.crew[post];
            const member = memberId ? data.characterById.get(memberId) : undefined;
            const golden = !!member && state.collection[member.id]?.golden > 0;
            return (
              <li key={post}>
                <button
                  type="button"
                  onClick={() => setPicking(post)}
                  aria-label={
                    member
                      ? `${POSTS[post].label} : ${member.name}, ${percent(postStrength(member, state.collection[member.id], post))}. Changer`
                      : `${POSTS[post].label} : poste libre. Choisir un personnage`
                  }
                  className={`flex h-full w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl p-2 text-left transition-colors sm:flex-col sm:items-stretch sm:gap-0 sm:p-0 ${
                    member
                      ? `bg-sea-800 hover:border-straw ${golden ? "border-[3px] border-straw" : "border border-sea-600"}`
                      : "border-2 border-dashed border-sea-600 hover:border-mist"
                  }`}
                >
                  <span className="relative flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-sea-700 sm:h-[132px] sm:w-full sm:rounded-none">
                    {member?.img ? (
                      <Image src={portraitUrl(member.img)} alt="" fill sizes="(min-width: 640px) 200px, 44px" className="object-cover object-top" />
                    ) : member ? (
                      <span className="font-display text-2xl text-mist/60 sm:text-5xl">{member.name.charAt(0)}</span>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="size-6 text-mist sm:size-8">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    )}
                  </span>
                  <span className={`flex min-w-0 flex-1 flex-col sm:p-3 ${member ? "" : "sm:bg-transparent"}`}>
                    <span className="text-[11px] font-extrabold tracking-wide text-mist uppercase sm:text-xs">{POSTS[post].label}</span>
                    <span className={`truncate text-sm font-bold sm:text-[15px] ${member ? "text-foam" : "text-mist"}`}>
                      {member ? member.name : "Poste libre"}
                    </span>
                    {member ? (
                      <span className="font-display text-base tracking-wide text-straw sm:text-lg">
                        {percent(postStrength(member, state.collection[member.id], post))}
                      </span>
                    ) : (
                      <span className="hidden text-[13px] text-mist sm:block">{POSTS[post].effect}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-[13px] text-mist">
          Touche un poste pour changer son occupant. Plus le personnage est rare, plus le bonus du poste est fort ; un avis doré le renforce
          encore.
        </p>
        {error && (
          <p role="alert" className="font-semibold text-vest">
            {error}
          </p>
        )}
      </section>

      <aside className="space-y-4">
        <Summary bonuses={bonuses} />
        <Traits traits={bonuses.traits} />
        <p className="text-[13px] text-mist">
          {bonuses.full
            ? `Équipage complet : ${percent(FULL_CREW_BONUS)} de Berrys sur tous les jeux.`
            : `${free} poste${free > 1 ? "s" : ""} libre${free > 1 ? "s" : ""} : pourvois les dix pour ${percent(FULL_CREW_BONUS)} de Berrys.`}
        </p>
      </aside>

      {picking && (
        <Modal title={POSTS[picking].label} onClose={() => setPicking(null)} wide>
          <p className="text-mist">
            {POSTS[picking].effect}. Choisis le personnage qui tiendra ce poste ; s&apos;il en occupe déjà un autre, il le quitte.
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
    </div>
  );
}

export function CrewView() {
  return <WithGameData loading="Chargement de l'équipage…">{({ data }) => <Crew data={data} />}</WithGameData>;
}
