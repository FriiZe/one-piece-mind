/**
 * Quiz à choix : un même déroulé (question, propositions, correction) pour
 * une douzaine de jeux. Chaque jeu n'apporte que son générateur de questions.
 */
import type { PlayCharacter, ResolvedData } from "../cards";
import { byDifficulty, type Difficulty } from "../engine/difficulty";
import { createRng, pick, randomInt, sample, shuffle, type Rng } from "../engine/rng";
import { formatBounty, formatHeight } from "../engine/text";
import { FRUIT_TYPE_LABELS, hakiLabel, RACE_LABELS, SEA_LABELS } from "@/lib/data/labels";
import { RACES, SEAS } from "@/lib/data/schema";

export const QCM_LENGTH = 10;
const CHOICES = 4;

export type QcmOption = { id: string; label: string; detail?: string };
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
const characterOption = (c: PlayCharacter): QcmOption => ({ id: c.id, label: c.name, detail: c.altName ?? undefined });

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

  return sample(rng, pool.filter((c) => c.affiliation), count).map((c) => ({
    id: c.id,
    title: "À quelle organisation appartient ce personnage ?",
    subject: c.name,
    detail: c.altName ?? undefined,
    img: c.img,
    options: choices(rng, c.affiliation!, common, (label) => label).map(asOption),
    answerId: c.affiliation!,
    explanation: `${c.name} : ${c.affiliation}.`,
  }));
};

const navires: Generator = (rng, data, _pool, count) => {
  const crews = data.extras.ships.map((ship) => ship.crew);
  return sample(rng, data.extras.ships, count).map((ship) => ({
    id: ship.name,
    title: "À quel équipage appartient ce navire ?",
    subject: ship.name,
    options: choices(rng, ship.crew, crews, (label) => label).map(asOption),
    answerId: ship.crew,
    explanation: `${ship.name} : ${ship.crew}.`,
  }));
};

const origineEtRace: Generator = (rng, _data, pool, count) => {
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
      const answer = SEA_LABELS[c.sea!];
      questions.push({
        id: `mer-${c.id}`,
        title: "De quelle mer vient ce personnage ?",
        subject: c.name,
        detail: c.altName ?? undefined,
        img: c.img,
        options: choices(rng, answer, SEAS.map((sea) => SEA_LABELS[sea]), (label) => label).map(asOption),
        answerId: answer,
        explanation: `${c.name} vient de : ${answer}.`,
      });
    } else {
      // Surtout des non-humains : « humain » serait sinon la réponse presque à chaque fois
      const c = (rng() < 0.75 ? take(nonHuman) : undefined) ?? take(human) ?? take(nonHuman);
      if (!c) continue;
      const race = c.races.find((r) => r !== "human") ?? c.races[0];
      const answer = RACE_LABELS[race];
      const others = RACES.filter((r) => !c.races.includes(r)).map((r) => RACE_LABELS[r]);
      questions.push({
        id: `race-${c.id}`,
        title: "À quelle race appartient ce personnage ?",
        subject: c.name,
        detail: c.altName ?? undefined,
        img: c.img,
        options: choices(rng, answer, others, (label) => label).map(asOption),
        answerId: answer,
        explanation: `${c.name} : ${answer}.`,
      });
    }
  }
  return questions;
};

const dansQuelArc: Generator = (rng, data, pool, count) => {
  const lastArc = Math.max(...data.characters.map((c) => c.arc ?? 0));
  const arcs = [...data.arcs].filter(([number]) => number <= lastArc).map(([, title]) => title);
  return sample(rng, pool.filter((c) => c.arc !== null), count).map((c) => {
    const answer = data.arcs.get(c.arc!)!;
    return {
      id: c.id,
      title: "Dans quel arc ce personnage apparaît-il pour la première fois ?",
      subject: c.name,
      detail: c.altName ?? undefined,
      img: c.img,
      options: choices(rng, answer, arcs, (label) => label).map(asOption),
      answerId: answer,
      explanation: `${c.name} apparaît dans l'arc ${answer}.`,
    };
  });
};

const TRUE_FALSE: QcmOption[] = [
  { id: "vrai", label: "Vrai" },
  { id: "faux", label: "Faux" },
];

const vraiOuFaux: Generator = (rng, data, pool, count) => {
  type Statement = { key: string; text: string; truth: boolean; correction: string };
  const other = <T>(items: readonly T[], not: T) => pick(rng, items.filter((item) => item !== not));
  const affiliations = [...new Set(data.characters.map((c) => c.affiliation).filter((a): a is string => !!a))];
  const arcs = [...new Set(data.characters.map((c) => c.arc).filter((a): a is number => a !== null))];

  const makers: (() => Statement | null)[] = [
    () => {
      const eaters = pool.filter((c) => c.fruitId && data.fruitById.has(c.fruitId));
      if (!eaters.length) return null;
      const c = pick(rng, eaters);
      const real = FRUIT_TYPE_LABELS[data.fruitById.get(c.fruitId!)!.type];
      const truth = rng() < 0.5;
      const shown = truth ? real : other(["Paramecia", "Logia", "Zoan"], real.startsWith("Zoan") ? "Zoan" : real);
      return {
        key: `fruit-${c.id}`,
        text: `${c.name} a mangé un fruit du démon de type ${shown}.`,
        truth,
        correction: `Son fruit est de type ${real}.`,
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
        text: `${c.name} fait partie de : ${shown}.`,
        truth,
        correction: `Son affiliation : ${c.affiliation}.`,
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
        text: `La prime de ${a.name} est plus élevée que celle de ${b.name}.`,
        truth: a.bounty! > b.bounty!,
        correction: `${a.name} : ${formatBounty(a.bounty)}. ${b.name} : ${formatBounty(b.bounty)}.`,
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
        text: `${c.name} maîtrise le haki des rois.`,
        truth,
        correction: `Ses hakis : ${hakiLabel(c.haki)}.`,
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
        text: `${c.name} apparaît pour la première fois dans l'arc ${data.arcs.get(shown)}.`,
        truth,
        correction: `Sa première apparition : arc ${data.arcs.get(c.arc!)}.`,
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
        text: `${c.name} est originaire de : ${SEA_LABELS[shown]}.`,
        truth,
        correction: `Son origine : ${SEA_LABELS[c.sea!]}.`,
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
      title: "Vrai ou faux ?",
      subject: statement.text,
      options: TRUE_FALSE,
      answerId: statement.truth ? "vrai" : "faux",
      explanation: statement.correction,
    });
  }
  return questions;
};

/** Quiz « à qui appartient… » sur un contenu rédigé à la main : technique, arme, surnom. */
function ownerQuiz(
  title: string,
  items: (data: ResolvedData) => { key: string; subject: string; detail?: string; characterId: string }[],
): Generator {
  return (rng, data, _pool, count) => {
    const all = items(data);
    const owners = [...new Set(all.map((item) => item.characterId))].map((id) => data.characterById.get(id)!);
    return sample(rng, all, count).map((item) => {
      const owner = data.characterById.get(item.characterId)!;
      return {
        id: item.key,
        title,
        subject: item.subject,
        detail: item.detail,
        options: choices(rng, owner, owners, (c) => c.id).map(characterOption),
        answerId: owner.id,
        explanation: `${item.subject} : ${owner.name}.`,
      };
    });
  };
}

const techniques = ownerQuiz("À qui appartient cette technique ?", (data) =>
  data.extras.techniques.map((t) => ({ key: t.name, subject: t.name, characterId: t.characterId })),
);
const armes = ownerQuiz("Qui manie cette arme ?", (data) =>
  data.extras.weapons.map((w) => ({ key: w.name, subject: w.name, detail: w.kind, characterId: w.characterId })),
);
const surnoms = ownerQuiz("Qui porte ce surnom ?", (data) =>
  data.extras.epithets.map((e) => ({ key: e.characterId, subject: `« ${e.text} »`, characterId: e.characterId })),
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

const orthographe: Generator = (rng, _data, pool, count) => {
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
      title: "Comment s'écrit le nom de ce personnage ?",
      subject: c.affiliation ?? "Personnage",
      img: c.img,
      options: shuffle(rng, [c.name, ...wrong]).map(asOption),
      answerId: c.name,
      explanation: `La bonne orthographe : ${c.name}.`,
    });
    if (questions.length === count) break;
  }
  return questions;
};

const grandOuVieux: Generator = (rng, _data, pool, count) => {
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
    const value = (c: PlayCharacter) => (criterion === "height" ? formatHeight(c.height) : `${c.age} ans`);
    questions.push({
      id,
      title: criterion === "height" ? "Qui est le plus grand ?" : "Qui est le plus âgé ?",
      subject: `${a.name} ou ${b.name} ?`,
      options: [characterOption(a), characterOption(b)],
      answerId: a[criterion]! > b[criterion]! ? a.id : b.id,
      explanation: `${a.name} : ${value(a)}. ${b.name} : ${value(b)}.`,
    });
  }
  return questions;
};

const HAKI_COMBOS = [
  hakiLabel([]),
  hakiLabel(["observation"]),
  hakiLabel(["armament"]),
  hakiLabel(["observation", "armament"]),
  hakiLabel(["observation", "armament", "conqueror"]),
];

const haki: Generator = (rng, _data, pool, count) => {
  // Deux tiers d'utilisateurs de haki : sinon « Aucun » serait presque toujours la réponse
  const users = sample(rng, pool.filter((c) => c.haki.length > 0), Math.ceil((count * 2) / 3));
  const others = sample(rng, pool.filter((c) => c.haki.length === 0), count - users.length);
  return shuffle(rng, [...users, ...others]).map((c) => {
    const answer = hakiLabel(c.haki);
    return {
      id: c.id,
      title: "Quels hakis ce personnage maîtrise-t-il ?",
      subject: c.name,
      detail: c.altName ?? undefined,
      img: c.img,
      options: choices(rng, answer, HAKI_COMBOS, (label) => label).map(asOption),
      answerId: answer,
      explanation: `${c.name} : ${answer}.`,
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

/** Une question de chaque jeu, tirée au hasard. */
const modeAleatoire: Generator = (rng, data, pool, count) => {
  const questions: QcmQuestion[] = [];
  for (let attempt = 0; questions.length < count && attempt < count * 5; attempt++) {
    const [question] = pick(rng, Object.values(BASE_GENERATORS))(rng, data, pool, 1);
    if (question && !questions.some((q) => q.id === question.id)) questions.push(question);
  }
  return questions;
};

const GENERATORS = { ...BASE_GENERATORS, "mode-aleatoire": modeAleatoire } satisfies Record<string, Generator>;

export type QcmSlug = keyof typeof GENERATORS;
export const QCM_SLUGS = Object.keys(GENERATORS) as [QcmSlug, ...QcmSlug[]];

/** Jeux dont les questions viennent d'un contenu rédigé : la difficulté n'y change rien. */
const FIXED_DIFFICULTY: readonly QcmSlug[] = ["navires", "techniques", "armes-et-sabres", "surnoms"];
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
