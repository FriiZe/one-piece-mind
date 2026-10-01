/**
 * Quiz à choix : un même déroulé (question, propositions, correction) pour
 * une douzaine de jeux. Chaque jeu n'apporte que son générateur de questions.
 */
import type { PlayCharacter, ResolvedData } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, pick, randomInt, sample, shuffle, type Rng } from "../engine/rng";
import { formatBounty, formatHeight } from "../engine/text";
import { FRUIT_TYPE_LABELS, hakiLabel, RACE_LABELS, SEA_LABELS, type HakiType } from "@/lib/data/labels";
import { RACES, SEAS } from "@/lib/data/schema";
import { isLiveSlug } from "@/lib/games/catalog";
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
};

type Generator = (rng: Rng, data: ResolvedData, pool: readonly PlayCharacter[], count: number) => QcmQuestion[];

const asOption = (label: string): QcmOption => ({ id: label, label });
const characterOption = (c: PlayCharacter): QcmOption => ({ id: c.id, label: c.name, detail: c.altName ?? undefined, img: c.img });

/** La bonne réponse et trois leurres, mélangés. */
function choices<T>(rng: Rng, answer: T, others: readonly T[], key: (item: T) => string): T[] {
  const distinct = new Map<string, T>();
  for (const item of others) if (key(item) !== key(answer)) distinct.set(key(item), item);
  return shuffle(rng, [answer, ...sample(rng, [...distinct.values()], CHOICES - 1)]);
}

const equipage: Generator = (rng, data, pool, count) => {
  // Les affiliations d'un seul membre sont trop obscures pour servir de leurres
  const counts = new Map<string, number>();
  for (const c of data.characters) if (c.affiliation) counts.set(c.affiliation, (counts.get(c.affiliation) ?? 0) + 1);
  const common = [...counts].filter(([, n]) => n >= 2).map(([label]) => label);

  const t = translator(data.locale);
  return sample(rng, pool.filter((c) => c.affiliation), count).map((c) => ({
    id: c.id,
    title: t("À quelle organisation appartient ce personnage ?", "Which organization does this character belong to?"),
    subject: c.name,
    detail: c.altName ?? undefined,
    img: c.img,
    options: choices(rng, c.affiliation!, common, (label) => label).map(asOption),
    answerId: c.affiliation!,
    explanation: t(`${c.name} : ${c.affiliation}.`, `${c.name}: ${c.affiliation}.`),
  }));
};

const navires: Generator = (rng, data, _pool, count) => {
  const t = translator(data.locale);
  const crews = data.extras.ships.map((ship) => ship.crew);
  return sample(rng, data.extras.ships, count).map((ship) => ({
    id: ship.name,
    title: t("À quel équipage appartient ce navire ?", "Which crew does this ship belong to?"),
    subject: ship.name,
    options: choices(rng, ship.crew, crews, (label) => label).map(asOption),
    answerId: ship.crew,
    explanation: t(`${ship.name} : ${ship.crew}.`, `${ship.name}: ${ship.crew}.`),
  }));
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
  return sample(rng, pool.filter((c) => c.arc !== null), count).map((c) => {
    const answer = data.arcs.get(c.arc!)!;
    return {
      id: c.id,
      title: t("Dans quel arc ce personnage apparaît-il pour la première fois ?", "In which arc does this character first appear?"),
      subject: c.name,
      detail: c.altName ?? undefined,
      img: c.img,
      options: choices(rng, answer, arcs, (label) => label).map(asOption),
      answerId: answer,
      explanation: t(`${c.name} apparaît dans l'arc ${answer}.`, `${c.name} first appears in the ${answer} arc.`),
    };
  });
};

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

  const makers: (() => Statement | null)[] = [
    () => {
      const eaters = pool.filter((c) => c.fruitId && data.fruitById.has(c.fruitId));
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
      const shown = truth ? c.affiliation! : other(affiliations, c.affiliation!);
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
  items: (data: ResolvedData) => { key: string; subject: string; detail?: string; characterId: string }[],
): Generator {
  return (rng, data, _pool, count) => {
    const all = items(data);
    const owners = [...new Set(all.map((item) => item.characterId))].map((id) => data.characterById.get(id)!);
    return sample(rng, all, count).map((item) => {
      const owner = data.characterById.get(item.characterId)!;
      return {
        id: item.key,
        title: title[data.locale],
        subject: item.subject,
        detail: item.detail,
        options: choices(rng, owner, owners, (c) => c.id).map(characterOption),
        answerId: owner.id,
        explanation: translator(data.locale)(`${item.subject} : ${owner.name}.`, `${item.subject}: ${owner.name}.`),
      };
    });
  };
}

/** Un surnom ou un rire, entre guillemets : français ou anglais selon la langue. */
const quoted = (text: string, data: ResolvedData) => translator(data.locale)(`« ${text} »`, `“${text}”`);

const techniques = ownerQuiz({ fr: "À qui appartient cette technique ?", en: "Whose technique is this?" }, (data) =>
  data.extras.techniques.map((t) => ({ key: t.name, subject: t.name, characterId: t.characterId })),
);
const armes = ownerQuiz({ fr: "Qui manie cette arme ?", en: "Who wields this weapon?" }, (data) =>
  data.extras.weapons.map((w) => ({ key: w.name, subject: w.name, detail: w.kind, characterId: w.characterId })),
);
const surnoms = ownerQuiz({ fr: "Qui porte ce surnom ?", en: "Who goes by this epithet?" }, (data) =>
  data.extras.epithets.map((e) => ({ key: e.characterId, subject: quoted(e.text, data), characterId: e.characterId })),
);

const rires = ownerQuiz({ fr: "À qui appartient ce rire ?", en: "Whose laugh is this?" }, (data) =>
  data.extras.laughs.map((l) => ({ key: l.characterId, subject: quoted(l.text, data), characterId: l.characterId })),
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
  // Le portrait désigne le personnage sans écrire son nom
  const subjects = pool.filter((c) => c.img && c.name.replace(/[^a-zà-ÿ]/gi, "").length >= 6);
  const questions: QcmQuestion[] = [];
  for (const c of sample(rng, subjects, count * 2)) {
    const wrong = new Set<string>();
    for (let attempt = 0; wrong.size < CHOICES - 1 && attempt < 40; attempt++) {
      const variant = misspell(rng, c.name);
      if (variant !== c.name) wrong.add(variant);
    }
    if (wrong.size < CHOICES - 1) continue;
    questions.push({
      id: c.id,
      title: t("Comment s'écrit le nom de ce personnage ?", "How is this character's name spelled?"),
      subject: c.affiliation ?? t("Personnage", "Character"),
      img: c.img,
      options: shuffle(rng, [c.name, ...wrong]).map(asOption),
      answerId: c.name,
      explanation: t(`La bonne orthographe : ${c.name}.`, `The correct spelling: ${c.name}.`),
    });
    if (questions.length === count) break;
  }
  return questions;
};

const grandOuVieux: Generator = (rng, data, pool, count) => {
  const { locale } = data;
  const t = translator(locale);
  const questions: QcmQuestion[] = [];
  for (let i = 0; questions.length < count && i < count * 5; i++) {
    const criterion = i % 2 === 0 ? "height" : "age";
    const measured = pool.filter((c) => c[criterion] !== null);
    if (measured.length < 2) continue;
    const a = pick(rng, measured);
    const rivals = measured.filter((c) => c.id !== a.id && c[criterion] !== a[criterion]);
    if (!rivals.length) continue;
    const b = pick(rng, rivals);
    const id = `${criterion}-${[a.id, b.id].sort().join("-")}`;
    if (questions.some((q) => q.id === id)) continue;
    const value = (c: PlayCharacter) =>
      criterion === "height" ? formatHeight(c.height, locale) : t(`${c.age} ans`, `${c.age} years old`);
    questions.push({
      id,
      title: criterion === "height" ? t("Qui est le plus grand ?", "Who is taller?") : t("Qui est le plus âgé ?", "Who is older?"),
      subject: t(`${a.name} ou ${b.name} ?`, `${a.name} or ${b.name}?`),
      options: [characterOption(a), characterOption(b)],
      answerId: a[criterion]! > b[criterion]! ? a.id : b.id,
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
  return shuffle(rng, [...users, ...others]).map((c) => {
    const answer = hakiLabel(c.haki, locale);
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
  rires,
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

/** Jeux dont les questions viennent d'un contenu rédigé : la difficulté n'y change rien. */
const FIXED_DIFFICULTY: readonly QcmSlug[] = ["navires", "techniques", "armes-et-sabres", "surnoms", "rires"];
export const usesDifficulty = (slug: QcmSlug) => !FIXED_DIFFICULTY.includes(slug);

export function generateQcm(slug: QcmSlug, seed: number, difficulty: Difficulty, data: ResolvedData): QcmQuestion[] {
  return GENERATORS[slug](createRng(seed), data, byDifficulty(data.characters, difficulty), QCM_LENGTH);
}

/** Rejoue une partie à partir de sa graine et des réponses données. */
export function evaluate(slug: QcmSlug, seed: number, difficulty: Difficulty, answers: readonly string[], data: ResolvedData) {
  const questions = generateQcm(slug, seed, difficulty, data);
  const score = questions.filter((question, index) => answers[index] === question.answerId).length;
  return { score, max: questions.length };
}
