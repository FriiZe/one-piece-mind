"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import Link from "@/components/Link";
import { portraitUrl, type ResolvedData } from "@/games/cards";
import { Button, Panel } from "@/games/ui/primitives";
import { WithGameData } from "@/games/ui/WithGameData";
import { translateAffiliation } from "@/lib/data/labels";
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
import type { Locale, Localized, Translate } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { CharacterCard } from "./CharacterCard";
import { Modal } from "./Modal";

const percent = (value: number, locale: Locale) => `+${Math.round(value * 100)}${locale === "en" ? "%" : " %"}`;

/** Libellé d'un bonus au milieu d'une phrase : en anglais, « Berries » garde sa majuscule. */
function midSentence(label: Localized, locale: Locale): string {
  if (locale !== "en") return label[locale].toLowerCase();
  return label.en.startsWith("Berries") ? label.en : label.en.charAt(0).toLowerCase() + label.en.slice(1);
}

/** Tous les bonus de l'équipage, postes et traits confondus, du plus général au plus particulier. */
function bonusLines(bonuses: CrewBonuses, t: Translate): { label: string; value: number }[] {
  return [
    { label: t("Berrys sur tous les jeux", "Berries on every game"), value: bonuses.berrys.all ?? 0 },
    { label: t("Berrys sur le défi du jour", "Berries on the daily challenge"), value: bonuses.berrys.daily ?? 0 },
    ...GAME_CATEGORIES.map((category) => ({
      label: t(`Berrys « ${category.title.fr} »`, `Berries on “${category.title.en}” games`),
      value: bonuses.berrys[category.id] ?? 0,
    })),
    { label: t("Chances de recruter", "Chance to recruit"), value: bonuses.recruit },
    { label: t("Chances d'avis doré", "Chance of a golden poster"), value: bonuses.golden },
    { label: t("Réduction à la boutique", "Discount at the shop"), value: bonuses.discount },
  ].filter((line) => line.value > 0);
}

function Summary({ bonuses }: { bonuses: CrewBonuses }) {
  const t = useT();
  const locale = useLocale();
  const lines = bonusLines(bonuses, t);
  return (
    <section aria-labelledby="bonus" className="space-y-2.5 rounded-2xl border border-straw/50 bg-straw/5 p-5">
      <h2 id="bonus" className="font-extrabold text-foam">
        {t("Ce que rapporte ton équipage", "What your crew brings in")}
      </h2>
      {lines.length === 0 ? (
        <p className="text-sm text-mist">
          {t("Aucun bonus pour l'instant : place une recrue à un poste.", "No bonus yet: assign a recruit to a post.")}
        </p>
      ) : (
        <dl className="space-y-1.5">
          {lines.map((line) => (
            <div key={line.label} className="flex items-baseline justify-between gap-3 text-[15px]">
              <dt className="text-mist">{line.label}</dt>
              <dd className="font-display text-xl tracking-wide text-straw">{percent(line.value, locale)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/** Traits d'équipage : les membres d'une même affiliation renforcent ensemble un bonus, par paliers. */
function Traits({ traits }: { traits: CrewTrait[] }) {
  const t = useT();
  const locale = useLocale();
  return (
    <section aria-labelledby="traits" className="space-y-4 rounded-2xl border border-sea-700 p-5">
      <div>
        <h2 id="traits" className="font-extrabold text-foam">
          {t("Traits d'équipage", "Crew traits")}
        </h2>
        <p className="mt-1 text-sm text-mist">
          {t(
            `${TRAIT_STEPS[0]} membres d'une même affiliation activent son trait ; il se renforce à ${TRAIT_STEPS.slice(1).join(" et ")}.`,
            `${TRAIT_STEPS[0]} members of the same affiliation activate its trait; it gets stronger at ${TRAIT_STEPS.slice(1).join(" and ")}.`,
          )}
        </p>
      </div>

      {traits.length === 0 ? (
        <p className="text-sm text-mist">
          {t("Aucun membre d'équipage n'a d'affiliation pour l'instant.", "No crew member has an affiliation yet.")}
        </p>
      ) : (
        <ul className="space-y-4">
          {traits.map((trait) => {
            const next = TRAIT_STEPS[trait.level];
            const effect = midSentence(trait.effect, locale);
            return (
              <li key={trait.affiliation} className="space-y-1.5">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="font-bold text-foam">{trait.name[locale]}</span>
                  {trait.level > 0 ? (
                    <span className="font-display text-xl tracking-wide text-straw">{percent(trait.value, locale)}</span>
                  ) : (
                    <span className="text-[13px] text-mist">{t("inactif", "inactive")}</span>
                  )}
                </p>
                <span
                  className="flex gap-1.5"
                  role="img"
                  aria-label={t(
                    `Palier ${trait.level} sur ${TRAIT_STEPS.length}`,
                    `Tier ${trait.level} of ${TRAIT_STEPS.length}`,
                  )}
                >
                  {TRAIT_STEPS.map((step, index) => (
                    <span key={step} className={`h-2 flex-1 rounded-full ${index < trait.level ? "bg-straw" : "bg-sea-700"}`} />
                  ))}
                </span>
                <p className="text-[13px] text-mist">
                  {t(
                    `${trait.count} membre${trait.count > 1 ? "s" : ""}`,
                    `${trait.count} ${trait.count === 1 ? "member" : "members"}`,
                  )}{" "}
                  · {trait.affiliation}
                  {next !== undefined
                    ? t(
                        ` · encore ${next - trait.count} pour ${percent(trait.values[trait.level], locale)} (${effect})`,
                        ` · ${next - trait.count} more for ${percent(trait.values[trait.level], locale)} (${effect})`,
                      )
                    : t(` · ${effect}, palier maximal`, ` · ${effect}, max tier`)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <details className="text-sm text-mist">
        <summary className="cursor-pointer font-bold text-foam underline underline-offset-4">
          {t("Voir tous les traits", "See all traits")}
        </summary>
        <ul className="mt-2 space-y-1.5">
          {[
            ...Object.entries(TRAITS).map(([org, trait]) => [translateAffiliation(org, locale), trait] as const),
            [t("Toute autre affiliation", "Any other affiliation"), DEFAULT_TRAIT] as const,
          ].map(([affiliation, trait]) => (
            <li key={affiliation}>
              <strong className="text-foam">{trait.name[locale]}</strong> ({affiliation}){t(" : ", ": ")}
              {midSentence(bonusLabel(trait.bonus), locale)},{" "}
              {trait.values.map((value) => percent(value, locale)).join(" / ")}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function Crew({ data }: { data: ResolvedData }) {
  const { state, assign } = usePlayer();
  const t = useT();
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<PostId | null>(null);

  const owned = useMemo(
    () =>
      data.characters
        .filter((c) => state.collection[c.id])
        .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name, locale)),
    [data.characters, state.collection, locale],
  );
  const bonuses = crewBonuses(state, data.characterById);
  const postOf = (characterId: string) => POST_IDS.find((post) => state.crew[post] === characterId);
  const aboard = new Map(bonuses.traits.map((trait) => [trait.affiliation, trait.count]));
  const free = POST_IDS.filter((post) => !state.crew[post] || !data.characterById.get(state.crew[post]!)).length;

  async function change(post: PostId, characterId: string | null) {
    setError(null);
    setPicking(null);
    const result = await assign(post, characterId);
    if (!result.ok) setError(t("Ce changement n'a pas pu être enregistré.", "This change couldn't be saved."));
  }

  if (owned.length === 0) {
    return (
      <Panel>
        <p className="text-mist">
          {t(
            "Tu n'as encore recruté personne. Valide un jeu du jour, ou passe à la boutique, pour accueillir ta première recrue : tu pourras ensuite lui confier un poste.",
            "You haven't recruited anyone yet. Clear a daily game, or drop by the shop, to welcome your first recruit: you can then give them a post.",
          )}
        </p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-bold">
          <Link href="/" className="text-straw underline underline-offset-4">
            {t("Voir les jeux du jour", "See the daily games")}
          </Link>
          <Link href="/boutique" className="text-straw underline underline-offset-4">
            {t("Aller à la boutique", "Go to the shop")}
          </Link>
        </p>
      </Panel>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="postes" className="space-y-3">
        <h2 id="postes" className="sr-only">
          {t("Les dix postes", "The ten posts")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
          {POST_IDS.map((post) => {
            const memberId = state.crew[post];
            const member = memberId ? data.characterById.get(memberId) : undefined;
            const golden = !!member && state.collection[member.id]?.golden > 0;
            const strength = member ? percent(postStrength(member, state.collection[member.id], post), locale) : "";
            return (
              <li key={post}>
                <button
                  type="button"
                  onClick={() => setPicking(post)}
                  aria-label={
                    member
                      ? t(
                          `${POSTS[post].label.fr} : ${member.name}, ${strength}. Changer`,
                          `${POSTS[post].label.en}: ${member.name}, ${strength}. Change`,
                        )
                      : t(
                          `${POSTS[post].label.fr} : poste libre. Choisir un personnage`,
                          `${POSTS[post].label.en}: vacant post. Choose a character`,
                        )
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
                    <span className="text-[11px] font-extrabold tracking-wide text-mist uppercase sm:text-xs">
                      {POSTS[post].label[locale]}
                    </span>
                    <span className={`truncate text-sm font-bold sm:text-[15px] ${member ? "text-foam" : "text-mist"}`}>
                      {member ? member.name : t("Poste libre", "Vacant post")}
                    </span>
                    {member ? (
                      <span className="font-display text-base tracking-wide text-straw sm:text-lg">{strength}</span>
                    ) : (
                      <span className="hidden text-[13px] text-mist sm:block">{POSTS[post].effect[locale]}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-[13px] text-mist">
          {t(
            "Touche un poste pour changer son occupant. Plus le personnage est rare, plus le bonus du poste est fort ; un avis doré le renforce encore.",
            "Tap a post to change who holds it. The rarer the character, the stronger the post's bonus; a golden poster boosts it even more.",
          )}
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
            ? t(
                `Équipage complet : ${percent(FULL_CREW_BONUS, locale)} de Berrys sur tous les jeux.`,
                `Full crew: ${percent(FULL_CREW_BONUS, locale)} Berries on every game.`,
              )
            : t(
                `${free} poste${free > 1 ? "s" : ""} libre${free > 1 ? "s" : ""} : pourvois les dix pour ${percent(FULL_CREW_BONUS, locale)} de Berrys.`,
                `${free} vacant ${free === 1 ? "post" : "posts"}: fill all ten for ${percent(FULL_CREW_BONUS, locale)} Berries.`,
              )}
        </p>
      </aside>

      {picking && (
        <Modal title={POSTS[picking].label[locale]} onClose={() => setPicking(null)} wide>
          <p className="text-mist">
            {POSTS[picking].effect[locale]}.{" "}
            {t(
              "Choisis le personnage qui tiendra ce poste ; s'il en occupe déjà un autre, il le quitte.",
              "Choose the character who will hold this post; if they already hold another one, they leave it.",
            )}
          </p>
          {state.crew[picking] && (
            <Button variant="secondary" onClick={() => change(picking, null)}>
              {t("Libérer le poste", "Vacate the post")}
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
                    note={`${percent(postStrength(character, entry, picking), locale)}${
                      current ? t(" · en poste", " · in this post") : other ? ` · ${POSTS[other].label[locale]}` : ""
                    }`}
                  />
                  {/* Pour composer un trait : l'affiliation, et le nombre de ses membres déjà à bord */}
                  {character.affiliation && (
                    <p className="mt-1 truncate text-center text-xs text-mist" title={character.affiliation}>
                      {character.affiliation}
                      {aboard.get(character.affiliation)
                        ? t(
                            ` · ${aboard.get(character.affiliation)} à bord`,
                            ` · ${aboard.get(character.affiliation)} aboard`,
                          )
                        : ""}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => change(picking, character.id)}
                    aria-label={t(
                      `Placer ${character.name} au poste de ${POSTS[picking].label.fr}`,
                      `Assign ${character.name} to the ${POSTS[picking].label.en} post`,
                    )}
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
  const t = useT();
  return (
    <WithGameData loading={t("Chargement de l'équipage…", "Loading the crew…")}>
      {({ data }) => <Crew data={data} />}
    </WithGameData>
  );
}
