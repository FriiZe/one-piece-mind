"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "@/components/Link";
import { portraitUrl, type PlayCharacter, type ResolvedData } from "@/games/cards";
import { Button, Panel } from "@/games/ui/primitives";
import { WithGameData } from "@/games/ui/WithGameData";
import { translateAffiliation } from "@/lib/data/labels";
import {
  assignPost,
  bonusLabel,
  CAPTAIN_FACTOR,
  CREW_NAME_MAX,
  crewBonuses,
  DEFAULT_TRAIT,
  FULL_CREW_BONUS,
  GOLDEN_FACTOR,
  MAX_DISCOUNT,
  POST_IDS,
  POSTS,
  postStrength,
  RARITY_LABELS,
  sameCrew,
  SAVED_CREWS_MAX,
  STRENGTH_BY_TIER,
  TRAIT_STEPS,
  TRAITS,
  traitOf,
  type CrewBonuses,
  type CrewTrait,
  type PostId,
} from "@/lib/economy";
import { GAME_CATEGORIES } from "@/lib/games/catalog";
import type { Locale, Localized, Translate } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { CharacterCard } from "./CharacterCard";

const FIELD =
  "h-11 rounded-[10px] border border-sea-600 bg-sea-900 px-3 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none";
const CHIP = "min-h-9 cursor-pointer rounded-full border px-3 text-[13px] font-bold transition-colors";
const chip = (on: boolean) => `${CHIP} ${on ? "border-straw bg-straw text-ink" : "border-sea-600 text-mist hover:text-foam"}`;

const TIERS = [1, 2, 3, 4];

/** Premier poste libre après celui-ci, dans l'ordre des postes ; `null` s'il n'y en a plus. */
function nextVacant(crew: Partial<Record<PostId, string>>, after: PostId): PostId | null {
  const start = POST_IDS.indexOf(after);
  for (let step = 1; step < POST_IDS.length; step++) {
    const post = POST_IDS[(start + step) % POST_IDS.length];
    if (!crew[post]) return post;
  }
  return null;
}

/**
 * Le banc : la collection, filtrée et triée par bonus, pour pourvoir le poste
 * choisi. Il reste ouvert d'un poste à l'autre, ses filtres aussi.
 */
function PostBench({
  post,
  data,
  owned,
  onPick,
  onVacate,
  onSwitch,
  onClose,
}: {
  post: PostId;
  data: ResolvedData;
  owned: PlayCharacter[];
  onPick: (characterId: string) => void;
  onVacate: () => void;
  onSwitch: (post: PostId) => void;
  onClose: () => void;
}) {
  const { state } = usePlayer();
  const t = useT();
  const locale = useLocale();
  const ref = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [tiers, setTiers] = useState<number[]>([]);
  const [goldenOnly, setGoldenOnly] = useState(false);
  const [affiliation, setAffiliation] = useState("");
  const [hideInPost, setHideInPost] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Sur un petit écran, le banc est sous les postes : on y descend à chaque changement de poste
  useEffect(() => {
    if (window.innerWidth < 1024) ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [post]);

  const bonuses = crewBonuses(state, data.characterById);
  const aboard = new Map(bonuses.traits.map((trait) => [trait.affiliation, trait.count]));
  const postOf = (characterId: string) => POST_IDS.find((p) => state.crew[p] === characterId);
  const holderId = state.crew[post];
  const holder = holderId ? data.characterById.get(holderId) : undefined;
  const next = nextVacant(state.crew, post);

  // Les affiliations possédées, celles déjà à bord en tête : c'est là qu'un trait se complète
  const orgs = new Map<string, string>();
  for (const character of owned) if (character.affiliation && character.org) orgs.set(character.affiliation, character.org);
  const affiliations = [...orgs.entries()]
    .map(([label, org]) => ({ label, trait: traitOf(org).name[locale], count: aboard.get(label) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, locale));

  const normalized = query.trim().toLocaleLowerCase(locale);
  const shown = owned
    .filter((character) => {
      const entry = state.collection[character.id];
      if (tiers.length > 0 && !tiers.includes(character.tier)) return false;
      if (goldenOnly && entry.golden === 0) return false;
      if (affiliation && character.affiliation !== affiliation) return false;
      if (hideInPost && postOf(character.id)) return false;
      if (normalized && !character.name.toLocaleLowerCase(locale).includes(normalized)) return false;
      return true;
    })
    .map((character) => ({ character, strength: postStrength(character, state.collection[character.id], post) }))
    .sort((a, b) => b.strength - a.strength || a.character.name.localeCompare(b.character.name, locale));

  const active = (tiers.length > 0 ? 1 : 0) + (goldenOnly ? 1 : 0) + (affiliation ? 1 : 0) + (hideInPost ? 1 : 0) + (normalized ? 1 : 0);
  const clear = () => {
    setQuery("");
    setTiers([]);
    setGoldenOnly(false);
    setAffiliation("");
    setHideInPost(false);
  };
  const strengthOf = (tier: number) => percent(STRENGTH_BY_TIER[tier] * (post === "capitaine" ? CAPTAIN_FACTOR : 1), locale);

  return (
    <section ref={ref} aria-labelledby="banc" className="scroll-mt-4 rounded-2xl border-2 border-straw/60 bg-sea-800">
      {/* L'en-tête suit le défilement : on sait toujours quel poste on pourvoit */}
      <header className="sticky top-0 z-10 space-y-2 rounded-t-2xl border-b border-sea-700 bg-sea-800 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="banc" className="font-display text-3xl tracking-wide text-straw">
              {POSTS[post].label[locale]}
            </h2>
            <p className="font-extrabold text-foam">{POSTS[post].effect[locale]}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Fermer le banc", "Close the bench")}
            className="min-h-10 shrink-0 cursor-pointer rounded-lg border border-sea-600 px-3 text-lg font-bold text-mist hover:text-foam"
          >
            ×
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {holder ? (
            <>
              <span className="text-mist">
                {t("En poste : ", "In post: ")}
                <strong className="text-foam">{holder.name}</strong> ·{" "}
                <span className="font-display text-base tracking-wide text-straw">{percent(postStrength(holder, state.collection[holder.id], post), locale)}</span>
              </span>
              <button type="button" onClick={onVacate} className="cursor-pointer font-bold text-mist underline underline-offset-4 hover:text-foam">
                {t("Libérer le poste", "Vacate the post")}
              </button>
            </>
          ) : (
            <span className="font-semibold text-mist">{t("Poste libre", "Vacant post")}</span>
          )}
          {next && (
            <Button variant="secondary" onClick={() => onSwitch(next)} className="min-h-9 py-0 text-sm">
              {t("Poste libre suivant", "Next vacant post")} →
            </Button>
          )}
        </div>
      </header>

      <div className="space-y-3 border-b border-sea-700 p-4">
        <p className="text-xs text-mist">
          {TIERS.map((tier) => `${RARITY_LABELS[locale][tier]} ${strengthOf(tier)}`).join(" · ")} ·{" "}
          {t(`doré ×${GOLDEN_FACTOR}`, `golden ×${GOLDEN_FACTOR}`).replace(".", locale === "fr" ? "," : ".")}
          {post === "capitaine" && t(" · le capitaine agit partout, son bonus est divisé par deux", " · the captain acts everywhere, so their bonus is halved")}
        </p>
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Chercher un nom…", "Search a name…")}
            aria-label={t("Chercher un personnage", "Search a character")}
            className={`${FIELD} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className={`${chip(filtersOpen)} sm:hidden`}
          >
            {t("Filtrer", "Filter")}
            {active > 0 && ` · ${active}`}
          </button>
        </div>
        <div className={`${filtersOpen ? "space-y-3" : "hidden"} sm:block sm:space-y-3`}>
          <div role="group" aria-label={t("Rareté", "Rarity")} className="flex flex-wrap gap-2">
            {TIERS.map((tier) => {
              const on = tiers.includes(tier);
              return (
                <button
                  key={tier}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTiers(on ? tiers.filter((value) => value !== tier) : [...tiers, tier])}
                  className={chip(on)}
                >
                  {RARITY_LABELS[locale][tier]}
                </button>
              );
            })}
            <button type="button" aria-pressed={goldenOnly} onClick={() => setGoldenOnly(!goldenOnly)} className={chip(goldenOnly)}>
              {t("Dorés", "Golden")}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <select
              value={affiliation}
              onChange={(event) => setAffiliation(event.target.value)}
              aria-label={t("Trait d'affiliation", "Affiliation trait")}
              className={`${FIELD} max-w-full`}
            >
              <option value="">{t("Tous les traits", "All traits")}</option>
              {affiliations.map((option) => (
                <option key={option.label} value={option.label}>
                  {option.label} · {option.trait}
                  {option.count > 0 && t(` · ${option.count} à bord`, ` · ${option.count} aboard`)}
                </option>
              ))}
            </select>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-mist">
              <input type="checkbox" checked={hideInPost} onChange={(event) => setHideInPost(event.target.checked)} className="size-[18px] accent-straw" />
              {t("Masquer ceux déjà en poste", "Hide those already in a post")}
            </label>
          </div>
        </div>
        <p className="flex flex-wrap items-baseline gap-x-3 text-sm text-mist">
          <span>
            {t(
              `${shown.length} personnage${shown.length > 1 ? "s" : ""}`,
              `${shown.length} ${shown.length === 1 ? "character" : "characters"}`,
            )}
          </span>
          {active > 0 && (
            <button type="button" onClick={clear} className="cursor-pointer font-bold underline underline-offset-4 hover:text-foam">
              {t("Effacer les filtres", "Clear filters")}
            </button>
          )}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="p-4 text-mist">{t("Aucun personnage ne correspond à ces filtres.", "No character matches these filters.")}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
          {shown.map(({ character, strength }) => {
            const entry = state.collection[character.id];
            const current = holderId === character.id;
            const other = current ? undefined : postOf(character.id);
            return (
              <li key={character.id} className={`relative rounded-md ${current ? "ring-4 ring-emerald-400" : ""}`}>
                <CharacterCard
                  character={character}
                  golden={entry.golden > 0}
                  note={`${percent(strength, locale)}${current ? t(" · en poste", " · in this post") : other ? ` · ${POSTS[other].label[locale]}` : ""}`}
                />
                {/* Pour composer un trait : l'affiliation, et le nombre de ses membres déjà à bord */}
                {character.affiliation && (
                  <p className="mt-1 truncate text-center text-xs text-mist" title={character.affiliation}>
                    {character.affiliation}
                    {aboard.get(character.affiliation)
                      ? t(` · ${aboard.get(character.affiliation)} à bord`, ` · ${aboard.get(character.affiliation)} aboard`)
                      : ""}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onPick(character.id)}
                  disabled={current}
                  aria-label={t(
                    `Placer ${character.name} au poste de ${POSTS[post].label.fr}`,
                    `Assign ${character.name} to the ${POSTS[post].label.en} post`,
                  )}
                  aria-pressed={current}
                  className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-straw disabled:cursor-default"
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const percent = (value: number, locale: Locale) => `+${Math.round(value * 100)}${locale === "en" ? "%" : " %"}`;

/** Libellé d'un bonus au milieu d'une phrase : en anglais, « Berries » garde sa majuscule. */
function midSentence(label: Localized, locale: Locale): string {
  if (locale !== "en") return label[locale].toLowerCase();
  return label.en.startsWith("Berries") ? label.en : label.en.charAt(0).toLowerCase() + label.en.slice(1);
}

/** Tous les bonus de l'équipage, postes et traits confondus, du plus général au plus particulier. */
function bonusLines(bonuses: CrewBonuses, t: Translate): { label: string; value: number; note?: string }[] {
  return [
    { label: t("Berrys sur tous les jeux", "Berries on every game"), value: bonuses.berrys.all ?? 0 },
    { label: t("Berrys sur le défi du jour", "Berries on the daily challenge"), value: bonuses.berrys.daily ?? 0 },
    ...GAME_CATEGORIES.map((category) => ({
      label: t(`Berrys « ${category.title.fr} »`, `Berries on “${category.title.en}” games`),
      value: bonuses.berrys[category.id] ?? 0,
    })),
    { label: t("Chances de recruter", "Chance to recruit"), value: bonuses.recruit },
    { label: t("Chances d'avis doré", "Chance of a golden poster"), value: bonuses.golden },
    {
      label: t("Réduction à la boutique", "Discount at the shop"),
      value: bonuses.discount,
      // Au-delà du plafond, le surplus ne sert à rien : on le dit plutôt que de le cacher
      note: bonuses.discount > MAX_DISCOUNT ? t(`max ${MAX_DISCOUNT * 100} %`, `max ${MAX_DISCOUNT * 100}%`) : undefined,
    },
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
              <dd className="font-display text-xl tracking-wide text-straw">
                {percent(line.value, locale)}
                {line.note && <span className="ml-1.5 font-sans text-sm font-normal text-mist">({line.note})</span>}
              </dd>
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

/**
 * Équipages enregistrés : garder de côté la composition en place, et y revenir d'un geste.
 * Utile pour changer d'équipage selon le jeu du jour, sans tout replacer poste par poste.
 */
function SavedCrews({ data }: { data: ResolvedData }) {
  const { state, saveCrewAs, switchCrew } = usePlayer();
  const t = useT();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const filled = POST_IDS.filter((post) => state.crew[post]).length;
  const taken = state.savedCrews.some((saved) => saved.name.toLowerCase() === name.trim().toLowerCase());

  const REASONS: Record<string, string> = {
    empty: t("Place d'abord quelqu'un à un poste.", "Assign someone to a post first."),
    "bad-name": t(`Donne-lui un nom de ${CREW_NAME_MAX} caractères au plus.`, `Give it a name of ${CREW_NAME_MAX} characters at most.`),
    limit: t(
      `Tu as déjà ${SAVED_CREWS_MAX} équipages enregistrés : supprimes-en un, ou réutilise un nom pour le remplacer.`,
      `You already have ${SAVED_CREWS_MAX} saved crews: delete one, or reuse a name to replace it.`,
    ),
  };
  async function run(action: () => ReturnType<typeof saveCrewAs>, success: string) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    setNote(
      result.ok
        ? { text: success, ok: true }
        : { text: REASONS[result.reason] ?? t("Ce changement n'a pas pu être enregistré.", "This change couldn't be saved."), ok: false },
    );
    return result.ok;
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const label = name.trim();
    const saved = await run(
      () => saveCrewAs(label),
      taken ? t(`« ${label} » est mis à jour.`, `“${label}” has been updated.`) : t(`« ${label} » est enregistré.`, `“${label}” has been saved.`),
    );
    if (saved) setName("");
  }

  return (
    <section aria-labelledby="equipages-enregistres" className="space-y-3 rounded-2xl border border-sea-700 p-4 sm:p-5">
      <div>
        <h2 id="equipages-enregistres" className="font-extrabold text-foam">
          {t("Équipages enregistrés", "Saved crews")}{" "}
          <span className="font-semibold text-mist">
            · {state.savedCrews.length} {t("sur", "of")} {SAVED_CREWS_MAX}
          </span>
        </h2>
        <p className="mt-1 text-sm text-mist">
          {t(
            "Garde de côté l'équipage en place pour y revenir d'un geste, selon le jeu du jour par exemple.",
            "Set the current crew aside and switch back to it in one tap, depending on the daily game for instance.",
          )}
        </p>
      </div>

      {state.savedCrews.length > 0 && (
        <ul className="space-y-2">
          {state.savedCrews.map((saved) => {
            const members = POST_IDS.flatMap((post) => (saved.crew[post] ? [saved.crew[post]] : []));
            // Un avis parti depuis (échangé, vendu) laissera son poste libre
            const missing = members.filter((id) => !state.collection[id] || !data.characterById.has(id)).length;
            const active = sameCrew(saved.crew, state.crew);
            return (
              <li key={saved.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2 ${active ? "border-emerald-400/60 bg-emerald-600/10" : "border-sea-700"}`}>
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate font-bold text-foam">{saved.name}</span>
                  <span className="block text-[13px] text-mist">
                    {t(`${members.length} poste${members.length > 1 ? "s" : ""}`, `${members.length} ${members.length === 1 ? "post" : "posts"}`)}
                    {missing > 0 &&
                      t(
                        ` · ${missing} avis que tu n'as plus`,
                        ` · ${missing} ${missing === 1 ? "poster" : "posters"} you no longer have`,
                      )}
                  </span>
                </span>
                {active ? (
                  <span className="text-sm font-extrabold text-emerald-300">{t("En place", "Active")}</span>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => run(() => switchCrew(saved.id), t(`« ${saved.name} » est en place.`, `“${saved.name}” is now active.`))}
                    className="min-h-10 py-0 text-sm"
                  >
                    {t("Mettre en place", "Switch to it")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => run(() => switchCrew(saved.id, true), t(`« ${saved.name} » est supprimé.`, `“${saved.name}” has been deleted.`))}
                  aria-label={t(`Supprimer l'équipage enregistré « ${saved.name} »`, `Delete the saved crew “${saved.name}”`)}
                  className="min-h-10 py-0 text-sm"
                >
                  {t("Supprimer", "Delete")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={save} className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-48">
          <span className="mb-1 block text-sm font-bold text-foam">{t("Enregistrer l'équipage en place sous le nom", "Save the current crew as")}</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={CREW_NAME_MAX}
            placeholder={t("Spécial primes", "Bounty special")}
            className="h-11 w-full rounded-[10px] border border-sea-600 bg-sea-900 px-3 text-foam placeholder:text-mist/60 focus:border-straw focus:outline-none"
          />
        </label>
        <Button type="submit" disabled={busy || !name.trim() || filled === 0} className="min-h-11">
          {taken ? t("Remplacer", "Replace") : t("Enregistrer", "Save")}
        </Button>
      </form>
      <p className={`text-sm font-semibold empty:hidden ${note?.ok ? "text-emerald-300" : "text-vest"}`} aria-live="polite">
        {note?.text}
      </p>
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
  const free = POST_IDS.filter((post) => !state.crew[post] || !data.characterById.get(state.crew[post]!)).length;

  /** Place quelqu'un, puis passe au poste libre suivant : on remplit l'équipage d'une traite. */
  async function change(post: PostId, characterId: string | null) {
    setError(null);
    const after = assignPost(state, post, characterId);
    if (characterId && typeof after !== "string") setPicking(nextVacant(after.crew, post) ?? post);
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
                  aria-pressed={picking === post}
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
                    picking === post ? "ring-4 ring-emerald-400 " : ""
                  }${
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
        {picking ? (
          <PostBench
            post={picking}
            data={data}
            owned={owned}
            onPick={(id) => change(picking, id)}
            onVacate={() => change(picking, null)}
            onSwitch={setPicking}
            onClose={() => setPicking(null)}
          />
        ) : (
          <p className="text-[13px] text-mist">
            {t(
              "Touche un poste pour changer son occupant. Plus le personnage est rare, plus le bonus du poste est fort ; un avis doré le renforce encore.",
              "Tap a post to change who holds it. The rarer the character, the stronger the post's bonus; a golden poster boosts it even more.",
            )}
          </p>
        )}
        {error && (
          <p role="alert" className="font-semibold text-vest">
            {error}
          </p>
        )}
        <SavedCrews data={data} />
      </section>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto">
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
