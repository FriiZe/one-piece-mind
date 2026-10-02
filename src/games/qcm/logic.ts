/**
 * Quiz à choix : un même déroulé (question, propositions, correction) pour
 * une douzaine de jeux. Chaque jeu n'apporte que son générateur de questions.
 */
import type { PlayCharacter, ResolvedData } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, pick, randomInt, sample, shuffle, type Rng } from "../engine/rng";
import { formatBounty, formatHeight } from "../engine/text";
import { FRUIT_TYPE_LABELS, hakiLabel, RACE_LABELS, SEA_LABELS, translateAffiliation, type HakiType } from "@/lib/data/labels";
import { RACES, SEAS } from "@/lib/data/schema";
import { hasDifficulty, isLiveSlug } from "@/lib/games/catalog";
import { translator, type Localized } from "@/lib/i18n";

export const QCM_LENGTH = 10;
const CHOICES = 4;

/** `img` : portrait affiché à côté de la proposition, quand c'est un personnage. */
export type QcmOption = { id: string; label: string; detail?: string; img?: string | null };
export type QcmQuestion = {
  id: string;
  /** Consigne, en petit au-dessus du sujet. */
  title: string;
  /** Ce sur quoi porte la question, en grand. */
  subject: string;
  detail?: string;
  /** Portrait à afficher (fichier dans /images/portraits). */
  img?: string | null;
  options: QcmOption[];
  answerId: string;
  /** Rappel de la bonne réponse, affiché après coup. */
  explanation: string;
  /** La question ne se comprend qu'avec ses propositions : sans elles, plusieurs réponses seraient justes. */
  closed?: true;
  /** Autres réponses justes quand la réponse s'écrit (Duo, Carré ou Cash) : l'autre équipage d'un personnage qui en a deux. */
  accepted?: string[];
};

type Generator = (rng: Rng, data: ResolvedData, pool: readonly PlayCharacter[], count: number) => QcmQuestion[];

/** Part des questions posées dans l'autre sens : de la réponse vers le sujet (« quel est le navire de cet équipage ? »). */
const REVERSE_SHARE = 1 / 3;

const asOption = (label: string): QcmOption => ({ id: label, label });
const characterOption = (c: PlayCharacter): QcmOption => ({ id: c.id, label: c.name, detail: c.altName ?? undefined, img: c.img });

/** La bonne réponse et trois leurres, mélangés. */
function choices<T>(rng: Rng, answer: T, others: readonly T[], key: (item: T) => string): T[] {
  const distinct = new Map<string, T>();
  for (const item of others) if (key(item) !== key(answer)) distinct.set(key(item), item);
  return shuffle(rng, [answer, ...sample(rng, [...distinct.values()], CHOICES - 1)]);
}

/** Toutes les organisations d'un personnage, actuelles ou passées, telles qu'elles s'affichent. */
function memberships(c: PlayCharacter, data: ResolvedData): Set<string> {
  return new Set([c.org, ...c.also, ...c.past].filter((key): key is string => !!key).map((key) => translateAffiliation(key, data.locale)));
}

const equipage: Generator = (rng, data, pool, count) => {
  // Les affiliations d'un seul membre sont trop obscures pour servir de leurres
  const counts = new Map<string, number>();
  for (const c of data.characters) if (c.affiliation) counts.set(c.affiliation, (counts.get(c.affiliation) ?? 0) + 1);
  const common = [...counts].filter(([, n]) => n >= 2).map(([label]) => label);
  // Leurres du sens inverse : des personnages qui n'ont jamais appartenu qu'à une seule organisation.
  // Un ancien membre, ou un allié, ferait une deuxième bonne réponse
  const loyal = pool.filter((c) => c.solo && c.affiliation);

  const t = translator(data.locale);
  return sample(rng, pool.filter((c) => c.affiliation), count).map((c): QcmQuestion => {
    const explanation = t(`${c.name} : ${c.affiliation}.`, `${c.name}: ${c.affiliation}.`);
    const outsiders = loyal.filter((other) => other.affiliation !== c.affiliation);
    if (common.includes(c.affiliation!) && outsiders.length >= CHOICES - 1 && rng() < REVERSE_SHARE) {
      return {
        id: `qui-${c.id}`,
        title: t("Lequel de ces personnages appartient à cette organisation ?", "Which of these characters belongs to this organization?"),
        subject: c.affiliation!,
        options: choices(rng, c, outsiders, (other) => other.id).map(characterOption),
        answerId: c.id,
        explanation,
        closed: true,
      };
    }
    return {
      id: c.id,
      title: t("À quelle organisation appartient ce personnage ?", "Which organization does this character belong to?"),
      subject: c.name,
      detail: c.altName ?? undefined,
      img: c.img,
      // Un personnage a parfois plusieurs organisations (la famille Charlotte et l'équipage de Big Mom) :
      // aucune des siennes ne sert de leurre, et les autres comptent quand la réponse s'écrit
      options: choices(rng, c.affiliation!, common.filter((label) => !memberships(c, data).has(label)), (label) => label).map(asOption),
      answerId: c.affiliation!,
      explanation,
      // Les libellés dans la langue du joueur, et les noms d'origine (« Kuja Pirates »)
      accepted: [...new Set([c.org!, ...c.also.flatMap((key) => [translateAffiliation(key, data.locale), key])])],
    };
  });
};

const navires: Generator = (rng, data, _pool, count) => {
  const t = translator(data.locale);
  const { ships } = data.extras;
  const crews = ships.map((ship) => ship.crew);
  return sample(rng, ships, count).map((ship): QcmQuestion => {
    const explanation = t(`${ship.name} : ${ship.crew}.`, `${ship.name}: ${ship.crew}.`);
    const others = ships.filter((other) => other.crew !== ship.crew).map((other) => other.name);
    // Un équipage qui a eu plusieurs navires n'est demandé que dans le sens direct
    const only = ships.every((other) => other === ship || other.crew !== ship.crew);
    if (only && rng() < REVERSE_SHARE) {
      return {
        id: `de-${ship.name}`,
        title: t("Quel est le navire de cet équipage ?", "Which ship belongs to this crew?"),
        subject: ship.crew,
        options: choices(rng, ship.name, others, (label) => label).map(asOption),
        answerId: ship.name,
        explanation,
        closed: true,
      };
    }
    return {
      id: ship.name,
      title: t("À quel équipage appartient ce navire ?", "Which crew does this ship belong to?"),
      subject: ship.name,
      options: choices(rng, ship.crew, crews, (label) => label).map(asOption),
      answerId: ship.crew,
      explanation,
    };
  });
};

const origineEtRace: Generator = (rng, data, pool, count) => {
  const t = translator(data.locale);
  const seas = SEA_LABELS[data.locale];
  const races = RACE_LABELS[data.locale];
  const withSea = shuffle(rng, pool.filter((c) => c.sea));
  const nonHuman = shuffle(rng, pool.filter((c) => c.races.some((race) => race !== "human")));
  const human = shuffle(rng, pool.filter((c) => c.races.length === 1 && c.races[0] === "human"));
  const used = new Set<string>();
  const take = (list: PlayCharacter[]) => {
    const c = list.find((candidate) => !used.has(candidate.id));
    if (c) used.add(c.id);
    return c;
  };

  const questions: QcmQuestion[] = [];
  for (let i = 0; questions.length < count && i < count * 3; i++) {
    if (i % 2 === 0) {
      const c = take(withSea);
      if (!c) continue;
      const answer = seas[c.sea!];
      const elsewhere = pool.filter((other) => other.sea && other.sea !== c.sea);
      if (elsewhere.length >= CHOICES - 1 && rng() < REVERSE_SHARE) {
        questions.push({
          id: `qui-mer-${c.id}`,
          title: t("Lequel de ces personnages vient de cette mer ?", "Which of these characters is from this sea?"),
          subject: answer,
          options: choices(rng, c, elsewhere, (other) => other.id).map(characterOption),
          answerId: c.id,
          explanation: t(`${c.name} vient de : ${answer}.`, `${c.name} is from: ${answer}.`),
          closed: true,
        });
        continue;
      }
      questions.push({
        id: `mer-${c.id}`,
        title: t("De quelle mer vient ce personnage ?", "Which sea is this character from?"),
        subject: c.name,
        detail: c.altName ?? undefined,
        img: c.img,
        options: choices(rng, answer, SEAS.map((sea) => seas[sea]), (label) => label).map(asOption),
        answerId: answer,
        explanation: t(`${c.name} vient de : ${answer}.`, `${c.name} is from: ${answer}.`),
      });
    } else {
      // Surtout des non-humains : « humain » serait sinon la réponse presque à chaque fois
      const c = (rng() < 0.75 ? take(nonHuman) : undefined) ?? take(human) ?? take(nonHuman);
      if (!c) continue;
      const race = c.races.find((r) => r !== "human") ?? c.races[0];
      const answer = races[race];
      const others = RACES.filter((r) => !c.races.includes(r)).map((r) => races[r]);
      // Un personnage dont la race n'est pas renseignée pourrait être de celle-ci
      const strangers = pool.filter((other) => other.races.length > 0 && !other.races.includes(race));
      if (race !== "human" && strangers.length >= CHOICES - 1 && rng() < REVERSE_SHARE) {
        questions.push({
          id: `qui-race-${c.id}`,
          title: t("Lequel de ces personnages appartient à cette race ?", "Which of these characters belongs to this race?"),
          subject: answer,
          options: choices(rng, c, strangers, (other) => other.id).map(characterOption),
          answerId: c.id,
          explanation: t(`${c.name} : ${answer}.`, `${c.name}: ${answer}.`),
          closed: true,
        });
        continue;
      }
      questions.push({
        id: `race-${c.id}`,
        title: t("À quelle race appartient ce personnage ?", "Which race does this character belong to?"),
        subject: c.name,
        detail: c.altName ?? undefined,
        img: c.img,
        options: choices(rng, answer, others, (label) => label).map(asOption),
        answerId: answer,
        explanation: t(`${c.name} : ${answer}.`, `${c.name}: ${answer}.`),
      });
    }
  }
  return questions;
};

const dansQuelArc: Generator = (rng, data, pool, count) => {
  const t = translator(data.locale);
  const lastArc = Math.max(...data.characters.map((c) => c.arc ?? 0));
  const arcs = [...data.arcs].filter(([number]) => number <= lastArc).map(([, title]) => title);
  return sample(rng, pool.filter((c) => c.arc !== null), count).map((c): QcmQuestion => {
    const answer = data.arcs.get(c.arc!)!;
    const explanation = t(`${c.name} apparaît dans l'arc ${answer}.`, `${c.name} first appears in the ${answer} arc.`);
    const later = pool.filter((other) => other.arc !== null && other.arc !== c.arc);
    if (later.length >= CHOICES - 1 && rng() < REVERSE_SHARE) {
      return {
        id: `qui-${c.id}`,
        title: t(
          "Lequel de ces personnages apparaît pour la première fois dans cet arc ?",
          "Which of these characters first appears in this arc?",
        ),
        subject: t(`Arc ${answer}`, `${answer} arc`),
        options: choices(rng, c, later, (other) => other.id).map(characterOption),
        answerId: c.id,
        explanation,
        closed: true,
      };
    }
    return {
      id: c.id,
      title: t("Dans quel arc ce personnage apparaît-il pour la première fois ?", "In which arc does this character first appear?"),
      subject: c.name,
      detail: c.altName ?? undefined,
      img: c.img,
      options: choices(rng, answer, arcs, (label) => label).map(asOption),
      answerId: answer,
      explanation,
    };
  });
};

/** Un surnom ou un nom de technique, entre guillemets : français ou anglais selon la langue. */
const quoted = (text: string, data: ResolvedData) => translator(data.locale)(`« ${text} »`, `“${text}”`);

const TRUE_FALSE: Localized<QcmOption[]> = {
  fr: [
    { id: "vrai", label: "Vrai" },
    { id: "faux", label: "Faux" },
  ],
  en: [
    { id: "vrai", label: "True" },
    { id: "faux", label: "False" },
  ],
};

const vraiOuFaux: Generator = (rng, data, pool, count) => {
  const { locale } = data;
  const t = translator(locale);
  type Statement = { key: string; text: string; truth: boolean; correction: string };
  const other = <T>(items: readonly T[], not: T) => pick(rng, items.filter((item) => item !== not));
  const affiliations = [...new Set(data.characters.map((c) => c.affiliation).filter((a): a is string => !!a))];
  const arcs = [...new Set(data.characters.map((c) => c.arc).filter((a): a is number => a !== null))];
  // Les contenus rédigés suivent le tirage : seuls ceux d'un personnage de `pool` sont cités
  const inPool = new Set(pool.map((c) => c.id));
  const owned = <T extends { characterId: string }>(items: readonly T[]) => items.filter((item) => inPool.has(item.characterId));
  // Barbe Noire a deux fruits : aucune affirmation sur « son » fruit ne serait sûre
  const eaters = pool.filter((c) => c.fruitId && data.fruitById.has(c.fruitId) && c.id !== "marshall-d-teach");
  const epithets = owned(data.extras.epithets);
  const techniques = owned(data.extras.techniques);
  const weapons = owned(data.extras.weapons);
  /** Comparaison de deux personnages sur une mesure : « A est plus grand que B ». */
  const duel = (
    key: string,
    measure: (c: PlayCharacter) => number | null,
    text: (a: PlayCharacter, b: PlayCharacter) => string,
    value: (c: PlayCharacter) => string,
  ): Statement | null => {
    const measured = pool.filter((c) => measure(c) !== null);
    if (measured.length < 2) return null;
    const a = pick(rng, measured);
    const rivals = measured.filter((c) => measure(c) !== measure(a));
    if (!rivals.length) return null;
    const b = pick(rng, rivals);
    return {
      key: `${key}:${a.id}:${b.id}`,
      text: text(a, b),
      truth: measure(a)! > measure(b)!,
      correction: t(`${a.name} : ${value(a)}. ${b.name} : ${value(b)}.`, `${a.name}: ${value(a)}. ${b.name}: ${value(b)}.`),
    };
  };

  const makers: (() => Statement | null)[] = [
    () => {
      if (!eaters.length) return null;
      const c = pick(rng, eaters);
      const type = data.fruitById.get(c.fruitId!)!.type;
      const real = FRUIT_TYPE_LABELS[locale][type];
      const truth = rng() < 0.5;
      const shown = truth ? real : other(["Paramecia", "Logia", "Zoan"], type.startsWith("zoan") ? "Zoan" : real);
      return {
        key: `fruit-${c.id}`,
        text: t(`${c.name} a mangé un fruit du démon de type ${shown}.`, `${c.name} ate a ${shown} Devil Fruit.`),
        truth,
        correction: t(`Son fruit est de type ${real}.`, `Their fruit is a ${real}.`),
      };
    },
    () => {
      const members = pool.filter((c) => c.affiliation);
      if (!members.length || affiliations.length < 2) return null;
      const c = pick(rng, members);
      const truth = rng() < 0.5;
      // Une autre de ses organisations ne ferait pas une affirmation fausse
      const own = memberships(c, data);
      const foreign = affiliations.filter((label) => !own.has(label));
      if (!truth && !foreign.length) return null;
      const shown = truth ? c.affiliation! : pick(rng, foreign);
      return {
        key: `affiliation-${c.id}`,
        text: t(`${c.name} fait partie de : ${shown}.`, `${c.name} belongs to: ${shown}.`),
        truth,
        correction: t(`Son affiliation : ${c.affiliation}.`, `Their affiliation: ${c.affiliation}.`),
      };
    },
    () => {
      const wanted = pool.filter((c) => c.bounty !== null);
      if (wanted.length < 2) return null;
      const a = pick(rng, wanted);
      const others = wanted.filter((c) => c.bounty !== a.bounty);
      if (!others.length) return null;
      const b = pick(rng, others);
      return {
        key: `prime:${a.id}:${b.id}`,
        text: t(`La prime de ${a.name} est plus élevée que celle de ${b.name}.`, `${a.name} has a higher bounty than ${b.name}.`),
        truth: a.bounty! > b.bounty!,
        correction: t(
          `${a.name} : ${formatBounty(a.bounty, locale)}. ${b.name} : ${formatBounty(b.bounty, locale)}.`,
          `${a.name}: ${formatBounty(a.bounty, locale)}. ${b.name}: ${formatBounty(b.bounty, locale)}.`,
        ),
      };
    },
    () => {
      const kings = pool.filter((c) => c.haki.includes("conqueror"));
      const others = pool.filter((c) => c.haki.length > 0 && !c.haki.includes("conqueror"));
      if (!kings.length || !others.length) return null;
      const truth = rng() < 0.5;
      const c = pick(rng, truth ? kings : others);
      return {
        key: `haki-${c.id}`,
        text: t(`${c.name} maîtrise le haki des rois.`, `${c.name} wields Conqueror's Haki.`),
        truth,
        correction: t(`Ses hakis : ${hakiLabel(c.haki, locale)}.`, `Their Haki: ${hakiLabel(c.haki, locale)}.`),
      };
    },
    () => {
      const known = pool.filter((c) => c.arc !== null);
      if (!known.length || arcs.length < 2) return null;
      const c = pick(rng, known);
      const truth = rng() < 0.5;
      const shown = truth ? c.arc! : other(arcs, c.arc!);
      return {
        key: `arc-${c.id}`,
        text: t(
          `${c.name} apparaît pour la première fois dans l'arc ${data.arcs.get(shown)}.`,
          `${c.name} first appears in the ${data.arcs.get(shown)} arc.`,
        ),
        truth,
        correction: t(`Sa première apparition : arc ${data.arcs.get(c.arc!)}.`, `Their first appearance: ${data.arcs.get(c.arc!)} arc.`),
      };
    },
    () => {
      const located = pool.filter((c) => c.sea);
      if (!located.length) return null;
      const c = pick(rng, located);
      const truth = rng() < 0.5;
      const shown = truth ? c.sea! : other(SEAS, c.sea!);
      return {
        key: `mer-${c.id}`,
        text: t(`${c.name} est originaire de : ${SEA_LABELS[locale][shown]}.`, `${c.name} is from: ${SEA_LABELS[locale][shown]}.`),
        truth,
        correction: t(`Son origine : ${SEA_LABELS[locale][c.sea!]}.`, `Their origin: ${SEA_LABELS[locale][c.sea!]}.`),
      };
    },
    () => {
      if (!eaters.length) return null;
      const c = pick(rng, eaters);
      const real = data.fruitById.get(c.fruitId!)!;
      // Le leurre est le fruit d'un autre personnage du tirage : un fruit aussi connu que le vrai
      const foreign = eaters.filter((eater) => eater.fruitId !== c.fruitId);
      const truth = !foreign.length || rng() < 0.5;
      const shown = truth ? real : data.fruitById.get(pick(rng, foreign).fruitId!)!;
      return {
        key: `fruit-nom-${c.id}`,
        text: t(`${c.name} a mangé ce fruit du démon : ${shown.name}.`, `${c.name} ate this Devil Fruit: ${shown.name}.`),
        truth,
        correction: t(`Son fruit : ${real.name}.`, `Their fruit: ${real.name}.`),
      };
    },
    () => {
      if (!epithets.length || data.extras.epithets.length < 2) return null;
      const own = pick(rng, epithets);
      const c = data.characterById.get(own.characterId)!;
      // Un surnom contenu dans un autre (« Le héros », « Le héros de la Marine ») ne ferait pas une affirmation fausse
      const overlaps = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());
      const foreign = data.extras.epithets.filter((e) => e.characterId !== c.id && !overlaps(e.text, own.text));
      const truth = !foreign.length || rng() < 0.5;
      const shown = truth ? own : pick(rng, foreign);
      return {
        key: `surnom-${c.id}`,
        text: t(`${c.name} a pour surnom ${quoted(shown.text, data)}.`, `${c.name} goes by ${quoted(shown.text, data)}.`),
        truth,
        correction: t(`Son surnom : ${quoted(own.text, data)}.`, `Their epithet: ${quoted(own.text, data)}.`),
      };
    },
    () => {
      const owners = [...new Set(data.extras.techniques.map((item) => item.characterId))];
      if (!techniques.length || owners.length < 2) return null;
      const technique = pick(rng, techniques);
      const owner = data.characterById.get(technique.characterId)!;
      const truth = rng() < 0.5;
      const shown = truth ? owner : data.characterById.get(other(owners, owner.id))!;
      return {
        key: `technique-${technique.name}`,
        text: t(
          `La technique ${quoted(technique.name, data)} appartient à ${shown.name}.`,
          `The technique ${quoted(technique.name, data)} belongs to ${shown.name}.`,
        ),
        truth,
        correction: t(`${technique.name} : ${owner.name}.`, `${technique.name}: ${owner.name}.`),
      };
    },
    () => {
      const owners = [...new Set(data.extras.weapons.map((item) => item.characterId))];
      if (!weapons.length || owners.length < 2) return null;
      const weapon = pick(rng, weapons);
      const owner = data.characterById.get(weapon.characterId)!;
      const truth = rng() < 0.5;
      const shown = truth ? owner : data.characterById.get(other(owners, owner.id))!;
      return {
        key: `arme-${weapon.name}`,
        text: t(
          `L'arme ${quoted(weapon.name, data)} (${weapon.kind}) appartient à ${shown.name}.`,
          `The weapon ${quoted(weapon.name, data)} (${weapon.kind}) belongs to ${shown.name}.`,
        ),
        truth,
        correction: t(`${weapon.name} : ${owner.name}.`, `${weapon.name}: ${owner.name}.`),
      };
    },
    () => {
      const truth = rng() < 0.5;
      const nonHuman = pool.filter((c) => c.races.some((race) => race !== "human"));
      const candidates = truth ? nonHuman : pool.filter((c) => c.races.length > 0);
      if (!candidates.length) return null;
      const c = pick(rng, candidates);
      const own = c.races.find((race) => race !== "human") ?? c.races[0];
      const shown = truth ? own : pick(rng, RACES.filter((race) => race !== "human" && !c.races.includes(race)));
      return {
        key: `race-${c.id}`,
        text: t(`${c.name} appartient à cette race : ${RACE_LABELS[locale][shown]}.`, `${c.name} belongs to this race: ${RACE_LABELS[locale][shown]}.`),
        truth,
        correction: t(`Sa race : ${RACE_LABELS[locale][own]}.`, `Their race: ${RACE_LABELS[locale][own]}.`),
      };
    },
    () =>
      duel(
        "taille",
        (c) => c.height,
        (a, b) => t(`${a.name} est plus grand${a.gender === "female" ? "e" : ""} que ${b.name}.`, `${a.name} is taller than ${b.name}.`),
        (c) => formatHeight(c.height, locale),
      ),
    () =>
      duel(
        "age",
        (c) => c.age,
        (a, b) => t(`${a.name} est plus âgé${a.gender === "female" ? "e" : ""} que ${b.name}.`, `${a.name} is older than ${b.name}.`),
        (c) => t(`${c.age} ans`, `${c.age} years old`),
      ),
    () => {
      // Deux personnages apparus dans des arcs différents : au chapitre près, la question serait injuste
      const known = pool.filter((c) => c.arc !== null);
      if (known.length < 2) return null;
      const a = pick(rng, known);
      const rivals = known.filter((c) => c.arc !== a.arc);
      if (!rivals.length) return null;
      const b = pick(rng, rivals);
      return {
        key: `avant:${a.id}:${b.id}`,
        text: t(`${a.name} apparaît dans l'histoire avant ${b.name}.`, `${a.name} appears in the story before ${b.name}.`),
        truth: a.debut < b.debut,
        correction: t(
          `${a.name} : arc ${data.arcs.get(a.arc!)}. ${b.name} : arc ${data.arcs.get(b.arc!)}.`,
          `${a.name}: ${data.arcs.get(a.arc!)} arc. ${b.name}: ${data.arcs.get(b.arc!)} arc.`,
        ),
      };
    },
  ];

  const questions: QcmQuestion[] = [];
  const seen = new Set<string>();
  for (let attempt = 0; questions.length < count && attempt < count * 10; attempt++) {
    const statement = pick(rng, makers)();
    if (!statement || seen.has(statement.key)) continue;
    seen.add(statement.key);
    questions.push({
      id: statement.key,
      title: t("Vrai ou faux ?", "True or false?"),
      subject: statement.text,
      options: TRUE_FALSE[locale],
      answerId: statement.truth ? "vrai" : "faux",
      explanation: statement.correction,
    });
  }
  return questions;
};

/** Quiz « à qui appartient… » sur un contenu rédigé à la main : technique, arme, surnom. */
function ownerQuiz(
  title: Localized,
  /** Consigne dans l'autre sens : du personnage vers ce qui lui appartient. */
  reverseTitle: Localized,
  items: (data: ResolvedData) => { key: string; subject: string; detail?: string; characterId: string }[],
): Generator {
  return (rng, data, _pool, count) => {
    const all = items(data);
    const owners = [...new Set(all.map((item) => item.characterId))].map((id) => data.characterById.get(id)!);
    return sample(rng, all, count).map((item): QcmQuestion => {
      const owner = data.characterById.get(item.characterId)!;
      const explanation = translator(data.locale)(`${item.subject} : ${owner.name}.`, `${item.subject}: ${owner.name}.`);
      const foreign = all.filter((other) => other.characterId !== item.characterId);
      if (foreign.length >= CHOICES - 1 && rng() < REVERSE_SHARE) {
        return {
          id: `de-${item.key}`,
          title: reverseTitle[data.locale],
          subject: owner.name,
          detail: owner.altName ?? undefined,
          img: owner.img,
          // Sans le détail de l'arme (« bâton climatique ») : il désignerait son porteur
          options: choices(rng, item, foreign, (other) => other.subject).map((other) => asOption(other.subject)),
          answerId: item.subject,
          explanation,
          closed: true,
        };
      }
      return {
        id: item.key,
        title: title[data.locale],
        subject: item.subject,
        detail: item.detail,
        options: choices(rng, owner, owners, (c) => c.id).map(characterOption),
        answerId: owner.id,
        explanation,
      };
    });
  };
}

const techniques = ownerQuiz(
  { fr: "À qui appartient cette technique ?", en: "Whose technique is this?" },
  { fr: "Laquelle de ces techniques appartient à ce personnage ?", en: "Which of these techniques belongs to this character?" },
  (data) => data.extras.techniques.map((t) => ({ key: t.name, subject: t.name, characterId: t.characterId })),
);
const armes = ownerQuiz(
  { fr: "Qui manie cette arme ?", en: "Who wields this weapon?" },
  { fr: "Quelle arme manie ce personnage ?", en: "Which weapon does this character wield?" },
  (data) => data.extras.weapons.map((w) => ({ key: w.name, subject: w.name, detail: w.kind, characterId: w.characterId })),
);
const surnoms = ownerQuiz(
  { fr: "Qui porte ce surnom ?", en: "Who goes by this epithet?" },
  { fr: "Quel est le surnom de ce personnage ?", en: "What is this character's epithet?" },
  (data) => data.extras.epithets.map((e) => ({ key: e.characterId, subject: quoted(e.text, data), characterId: e.characterId })),
);

const VOWEL_SWAPS: Record<string, string> = { a: "e", e: "a", i: "y", y: "i", o: "u", u: "o" };
const CONSONANT_SWAPS: Record<string, string> = { k: "c", c: "k", s: "z", z: "s" };
const isLetter = (ch: string | undefined) => !!ch && /[a-zà-ÿ]/i.test(ch);
const keepCase = (source: string, replacement: string) =>
  source === source.toUpperCase() ? replacement.toUpperCase() : replacement;

/** Une faute plausible dans un nom : lettres inversées, doublées, ou voyelle voisine. */
export function misspell(rng: Rng, name: string): string {
  // On ne touche ni à la première lettre de chaque mot (la faute doit rester discrète), ni aux
  // mots courts : initiales et chiffres romains (« D. », « III ») ne se prêtent pas à une faute crédible
  const positions: number[] = [];
  for (const match of name.matchAll(/[a-zà-ÿ]{4,}/gi)) {
    for (let i = match.index + 1; i < match.index + match[0].length; i++) positions.push(i);
  }
  if (positions.length < 2) return name;
  const i = pick(rng, positions);
  const ch = name[i];
  const lower = ch.toLowerCase();
  const kind = randomInt(rng, 4);

  if (kind === 0 && i + 1 < name.length && isLetter(name[i + 1]) && name[i + 1] !== ch) {
    return name.slice(0, i) + name[i + 1] + ch + name.slice(i + 2);
  }
  if (kind === 1) {
    // Doubler une consonne simple, ou dédoubler une consonne double
    if (name[i - 1]?.toLowerCase() === lower) return name.slice(0, i) + name.slice(i + 1);
    if (!"aeiouyàâéèêëîïôöùûü".includes(lower)) return name.slice(0, i) + ch + name.slice(i);
  }
  if (VOWEL_SWAPS[lower]) return name.slice(0, i) + keepCase(ch, VOWEL_SWAPS[lower]) + name.slice(i + 1);
  if (CONSONANT_SWAPS[lower]) return name.slice(0, i) + keepCase(ch, CONSONANT_SWAPS[lower]) + name.slice(i + 1);
  return name.slice(0, i) + ch + name.slice(i);
}

const orthographe: Generator = (rng, data, pool, count) => {
  const t = translator(data.locale);
  const letters = (name: string) => name.replace(/[^a-zà-ÿ]/gi, "").length;
  /** Trois mauvaises graphies d'un nom, ou `null` s'il ne s'y prête pas. */
  const misspellings = (name: string): string[] | null => {
    const wrong = new Set<string>();
    for (let attempt = 0; wrong.size < CHOICES - 1 && attempt < 40; attempt++) {
      const variant = misspell(rng, name);
      if (variant !== name) wrong.add(variant);
    }
    return wrong.size < CHOICES - 1 ? null : [...wrong];
  };

  // Le portrait désigne le personnage sans écrire son nom
  const pictured = pool.filter((c) => c.img);
  const subjects = pictured.filter((c) => letters(c.name) >= 6);
  // Techniques et armes des personnages du tirage : le portrait de leur propriétaire les situe
  const owners = new Map(pictured.map((c) => [c.id, c]));
  const items = [
    ...data.extras.techniques.map((item) => ({ ...item, key: `technique-${item.name}`, weapon: false })),
    ...data.extras.weapons.map((item) => ({ ...item, key: `arme-${item.name}`, weapon: true })),
  ].filter((item) => owners.has(item.characterId) && letters(item.name) >= 6);

  const questions: QcmQuestion[] = [];
  const names = shuffle(rng, subjects);
  const things = shuffle(rng, items);
  for (let attempt = 0; questions.length < count && attempt < count * 4; attempt++) {
    const thing = rng() < REVERSE_SHARE ? things.pop() : undefined;
    if (thing) {
      const wrong = misspellings(thing.name);
      if (!wrong) continue;
      const owner = owners.get(thing.characterId)!;
      questions.push({
        id: thing.key,
        title: thing.weapon
          ? t("Comment s'écrit le nom de cette arme ?", "How is this weapon's name spelled?")
          : t("Comment s'écrit le nom de cette technique ?", "How is this technique's name spelled?"),
        subject: owner.name,
        detail: owner.altName ?? undefined,
        img: owner.img,
        options: shuffle(rng, [thing.name, ...wrong]).map(asOption),
        answerId: thing.name,
        explanation: t(`La bonne orthographe : ${thing.name}.`, `The correct spelling: ${thing.name}.`),
      });
      continue;
    }
    const c = names.pop();
    if (!c) continue;
    const wrong = misspellings(c.name);
    if (!wrong) continue;
    questions.push({
      id: c.id,
      title: t("Comment s'écrit le nom de ce personnage ?", "How is this character's name spelled?"),
      subject: c.affiliation ?? t("Personnage", "Character"),
      img: c.img,
      options: shuffle(rng, [c.name, ...wrong]).map(asOption),
      answerId: c.name,
      explanation: t(`La bonne orthographe : ${c.name}.`, `The correct spelling: ${c.name}.`),
    });
  }
  return questions;
};

const grandOuVieux: Generator = (rng, data, pool, count) => {
  const { locale } = data;
  const t = translator(locale);
  const questions: QcmQuestion[] = [];
  const pairs = new Set<string>();
  for (let i = 0; questions.length < count && i < count * 5; i++) {
    const criterion = i % 2 === 0 ? "height" : "age";
    const measured = pool.filter((c) => c[criterion] !== null);
    if (measured.length < 2) continue;
    const a = pick(rng, measured);
    const rivals = measured.filter((c) => c.id !== a.id && c[criterion] !== a[criterion]);
    if (!rivals.length) continue;
    const b = pick(rng, rivals);
    const pair = `${criterion}-${[a.id, b.id].sort().join("-")}`;
    if (pairs.has(pair)) continue;
    pairs.add(pair);
    // Une fois sur trois, la question est retournée : le plus petit, le plus jeune
    const least = rng() < REVERSE_SHARE;
    const value = (c: PlayCharacter) =>
      criterion === "height" ? formatHeight(c.height, locale) : t(`${c.age} ans`, `${c.age} years old`);
    questions.push({
      id: least ? `min-${pair}` : pair,
      title:
        criterion === "height"
          ? least
            ? t("Qui est le plus petit ?", "Who is shorter?")
            : t("Qui est le plus grand ?", "Who is taller?")
          : least
            ? t("Qui est le plus jeune ?", "Who is younger?")
            : t("Qui est le plus âgé ?", "Who is older?"),
      subject: t(`${a.name} ou ${b.name} ?`, `${a.name} or ${b.name}?`),
      options: [characterOption(a), characterOption(b)],
      answerId: a[criterion]! > b[criterion]! !== least ? a.id : b.id,
      explanation: t(`${a.name} : ${value(a)}. ${b.name} : ${value(b)}.`, `${a.name}: ${value(a)}. ${b.name}: ${value(b)}.`),
    });
  }
  return questions;
};

const HAKI_COMBOS: HakiType[][] = [[], ["observation"], ["armament"], ["observation", "armament"], ["observation", "armament", "conqueror"]];

const haki: Generator = (rng, data, pool, count) => {
  const { locale } = data;
  const t = translator(locale);
  const combos = HAKI_COMBOS.map((combo) => hakiLabel(combo, locale));
  // Deux tiers d'utilisateurs de haki : sinon « Aucun » serait presque toujours la réponse
  const users = sample(rng, pool.filter((c) => c.haki.length > 0), Math.ceil((count * 2) / 3));
  const others = sample(rng, pool.filter((c) => c.haki.length === 0), count - users.length);
  const withoutKings = pool.filter((c) => c.haki.length > 0 && !c.haki.includes("conqueror"));
  return shuffle(rng, [...users, ...others]).map((c): QcmQuestion => {
    const answer = hakiLabel(c.haki, locale);
    // Pour un détenteur du haki des rois, une fois sur deux : le retrouver parmi d'autres utilisateurs de haki
    if (c.haki.includes("conqueror") && withoutKings.length >= CHOICES - 1 && rng() < 0.5) {
      return {
        id: `rois-${c.id}`,
        title: t("Lequel de ces personnages maîtrise le haki des rois ?", "Which of these characters wields Conqueror's Haki?"),
        subject: t("Haki des rois", "Conqueror's Haki"),
        options: choices(rng, c, withoutKings, (other) => other.id).map(characterOption),
        answerId: c.id,
        explanation: t(`${c.name} : ${answer}.`, `${c.name}: ${answer}.`),
        closed: true,
      };
    }
    return {
      id: c.id,
      title: t("Quels hakis ce personnage maîtrise-t-il ?", "Which types of Haki does this character wield?"),
      subject: c.name,
      detail: c.altName ?? undefined,
      img: c.img,
      options: choices(rng, answer, combos, (label) => label).map(asOption),
      answerId: answer,
      explanation: t(`${c.name} : ${answer}.`, `${c.name}: ${answer}.`),
    };
  });
};

const BASE_GENERATORS = {
  equipage,
  navires,
  "origine-et-race": origineEtRace,
  "dans-quel-arc": dansQuelArc,
  "vrai-ou-faux": vraiOuFaux,
  techniques,
  "armes-et-sabres": armes,
  surnoms,
  orthographe,
  "grand-ou-vieux": grandOuVieux,
  haki,
} satisfies Record<string, Generator>;

/**
 * Quiz utilisables en multijoueur et dans le mode aléatoire : tous ceux dont le
 * jeu est en ligne, sauf le mode aléatoire qui n'est qu'un mélange des autres.
 */
export type MixSlug = keyof typeof BASE_GENERATORS;
export const MIX_SLUGS = (Object.keys(BASE_GENERATORS) as MixSlug[]).filter((slug) => isLiveSlug(slug));

/** Une question de chaque jeu, tirée au hasard. */
const modeAleatoire: Generator = (rng, data, pool, count) => {
  const questions: QcmQuestion[] = [];
  for (let attempt = 0; questions.length < count && attempt < count * 5; attempt++) {
    const [question] = BASE_GENERATORS[pick(rng, MIX_SLUGS)](rng, data, pool, 1);
    if (question && !questions.some((q) => q.id === question.id)) questions.push(question);
  }
  return questions;
};

/** `count` questions tirées parmi les quiz choisis, toutes différentes. */
export function generateMixed(
  seed: number,
  slugs: readonly MixSlug[],
  count: number,
  difficulty: Difficulty,
  data: ResolvedData,
): QcmQuestion[] {
  const rng = createRng(seed);
  const pool = byDifficulty(data.characters, difficulty);
  // Un salon ouvert avant la mise en pause d'un jeu peut encore le citer
  const live = slugs.filter((slug) => MIX_SLUGS.includes(slug));
  const sources = live.length > 0 ? live : MIX_SLUGS;
  const questions: QcmQuestion[] = [];
  for (let attempt = 0; questions.length < count && attempt < count * 8; attempt++) {
    const slug = pick(rng, sources);
    const [question] = BASE_GENERATORS[slug](rng, data, pool, 1);
    // L'identifiant est préfixé par le jeu : deux quiz peuvent porter sur le même personnage
    const id = `${slug}:${question?.id}`;
    if (question && !questions.some((q) => q.id === id)) questions.push({ ...question, id });
  }
  return questions;
}

/** Quiz dont les questions peuvent porter sur un petit groupe de personnages donné. */
const POOL_SLUGS: MixSlug[] = ["equipage", "origine-et-race", "haki", "vrai-ou-faux", "orthographe", "grand-ou-vieux"];

/** Une question sur les personnages de `pool`, tirée dans l'un de ces quiz ; `null` si aucun n'a de quoi en poser. */
export function questionFor(rng: Rng, data: ResolvedData, pool: readonly PlayCharacter[]): QcmQuestion | null {
  for (const slug of shuffle(rng, POOL_SLUGS)) {
    const [question] = BASE_GENERATORS[slug](rng, data, pool, 1);
    if (question) return question;
  }
  return null;
}

const GENERATORS = { ...BASE_GENERATORS, "mode-aleatoire": modeAleatoire } satisfies Record<string, Generator>;

export type QcmSlug = keyof typeof GENERATORS;
export const QCM_SLUGS = Object.keys(GENERATORS) as [QcmSlug, ...QcmSlug[]];

/** Faux pour les jeux dont les questions viennent d'un contenu rédigé : la difficulté n'y change rien. */
export const usesDifficulty = (slug: QcmSlug) => hasDifficulty(slug);

export function generateQcm(slug: QcmSlug, seed: number, difficulty: Difficulty, data: ResolvedData): QcmQuestion[] {
  return GENERATORS[slug](createRng(seed), data, byDifficulty(data.characters, difficulty), QCM_LENGTH);
}

/** Rejoue une partie à partir de sa graine et des réponses données. */
export function evaluate(slug: QcmSlug, seed: number, difficulty: Difficulty, answers: readonly string[], data: ResolvedData) {
  const questions = generateQcm(slug, seed, difficulty, data);
  const score = questions.filter((question, index) => answers[index] === question.answerId).length;
  return { score, max: questions.length };
}
