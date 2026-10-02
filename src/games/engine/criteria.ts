/**
 * Critères : des propriétés que l'on peut vérifier sur un personnage (« vient
 * d'East Blue », « maîtrise le haki des rois »). Ils servent aux jeux qui
 * classent ou recoupent des personnages : Connexions, Grille 3×3, Den Den Devin.
 * Tout part des données déjà ramenées au mode du joueur : aucun critère ne
 * peut révéler ce qu'il n'a pas encore vu.
 */
import type { PlayCharacter, ResolvedData } from "../cards";
import { RACE_LABELS, SEA_LABELS, translateAffiliation } from "@/lib/data/labels";
import { RACES, SEAS } from "@/lib/data/schema";
import { normalizeText } from "./text";
import { translator } from "@/lib/i18n";

export type CriterionKind =
  | "affiliation"
  | "group"
  | "sea"
  | "race"
  | "fruit"
  | "haki"
  | "bounty"
  | "arc"
  | "gender"
  | "size"
  | "age"
  | "initial";

export type Criterion = {
  id: string;
  kind: CriterionKind;
  /** Intitulé d'une famille ou d'une case : « Origine : East Blue ». */
  label: string;
  /** La même chose sous forme de question, pour Den Den Devin : « Vient-il d'East Blue ? » */
  question: string;
  test: (character: PlayCharacter) => boolean;
};

const BILLION = 1_000_000_000;

const built = new WeakMap<ResolvedData, Criterion[]>();

/** Tous les critères qui concernent au moins quatre personnages connus du joueur. */
export function criteriaFor(data: ResolvedData): Criterion[] {
  const cached = built.get(data);
  if (cached) return cached;

  const t = translator(data.locale);
  const seas = SEA_LABELS[data.locale];
  const races = RACE_LABELS[data.locale];
  const zoan = (c: PlayCharacter) => !!c.fruitId && !!data.fruitById.get(c.fruitId)?.type.startsWith("zoan");
  const fruitType = (c: PlayCharacter) => (c.fruitId ? data.fruitById.get(c.fruitId)?.type : undefined);
  const all: Criterion[] = [];

  const affiliations = new Map<string, number>();
  for (const c of data.characters) if (c.affiliation) affiliations.set(c.affiliation, (affiliations.get(c.affiliation) ?? 0) + 1);
  // Un personnage compte dans chacune de ses organisations actuelles : Katakuri est de la famille
  // Charlotte, et de l'équipage de Big Mom
  const current = new Map(
    data.characters.map((c) => [c.id, new Set(c.also.map((key) => translateAffiliation(key, data.locale)))] as const),
  );
  for (const [affiliation] of affiliations) {
    all.push({
      id: `affiliation:${affiliation}`,
      kind: "affiliation",
      label: affiliation,
      question: t(`Fait-il partie de : ${affiliation} ?`, `Do they belong to: ${affiliation}?`),
      test: (c) => c.affiliation === affiliation || !!current.get(c.id)?.has(affiliation),
    });
  }

  for (const group of data.groups) {
    const members = new Set(group.memberIds);
    all.push({
      id: `group:${group.id}`,
      kind: "group",
      label: group.title,
      question: t(`Fait-il partie de ce groupe : ${group.title} ?`, `Are they part of this group: ${group.title}?`),
      test: (c) => members.has(c.id),
    });
  }

  for (const sea of SEAS) {
    all.push({
      id: `sea:${sea}`,
      kind: "sea",
      label: t(`Origine : ${seas[sea]}`, `Origin: ${seas[sea]}`),
      question: t(`Vient-il de : ${seas[sea]} ?`, `Are they from: ${seas[sea]}?`),
      test: (c) => c.sea === sea,
    });
  }

  for (const race of RACES) {
    all.push({
      id: `race:${race}`,
      kind: "race",
      label: t(`Race : ${races[race]}`, `Race: ${races[race]}`),
      question: t(`Est-il de cette race : ${races[race]} ?`, `Are they of this race: ${races[race]}?`),
      test: (c) => c.races.includes(race),
    });
  }

  all.push(
    {
      id: "fruit:any",
      kind: "fruit",
      label: t("A mangé un fruit du démon", "Ate a Devil Fruit"),
      question: t("A-t-il mangé un fruit du démon ?", "Have they eaten a Devil Fruit?"),
      test: (c) => !!c.fruitId,
    },
    {
      id: "fruit:logia",
      kind: "fruit",
      label: t("Fruit de type Logia", "Logia fruit"),
      question: t("Son fruit est-il un Logia ?", "Is their fruit a Logia?"),
      test: (c) => fruitType(c) === "logia",
    },
    {
      id: "fruit:zoan",
      kind: "fruit",
      label: t("Fruit de type Zoan", "Zoan fruit"),
      question: t("Son fruit est-il un Zoan ?", "Is their fruit a Zoan?"),
      test: zoan,
    },
    {
      id: "fruit:paramecia",
      kind: "fruit",
      label: t("Fruit de type Paramecia", "Paramecia fruit"),
      question: t("Son fruit est-il un Paramecia ?", "Is their fruit a Paramecia?"),
      test: (c) => fruitType(c) === "paramecia",
    },
    {
      id: "fruit:zoan-mythical",
      kind: "fruit",
      label: t("Fruit de type Zoan mythique", "Mythical Zoan fruit"),
      question: t("Son fruit est-il un Zoan mythique ?", "Is their fruit a Mythical Zoan?"),
      test: (c) => fruitType(c) === "zoan-mythical",
    },
    {
      id: "fruit:zoan-ancient",
      kind: "fruit",
      label: t("Fruit de type Zoan antique", "Ancient Zoan fruit"),
      question: t("Son fruit est-il un Zoan antique ?", "Is their fruit an Ancient Zoan?"),
      test: (c) => fruitType(c) === "zoan-ancient",
    },
    {
      id: "fruit:none",
      kind: "fruit",
      label: t("N'a pas mangé de fruit du démon", "Has not eaten a Devil Fruit"),
      question: t("Est-il dépourvu de fruit du démon ?", "Are they without a Devil Fruit?"),
      test: (c) => !c.fruitId,
    },
    {
      id: "haki:conqueror",
      kind: "haki",
      label: t("Maîtrise le haki des rois", "Wields Conqueror's Haki"),
      question: t("Maîtrise-t-il le haki des rois ?", "Do they wield Conqueror's Haki?"),
      test: (c) => c.haki.includes("conqueror"),
    },
    {
      id: "haki:observation",
      kind: "haki",
      label: t("Maîtrise le haki de l'observation", "Wields Observation Haki"),
      question: t("Maîtrise-t-il le haki de l'observation ?", "Do they wield Observation Haki?"),
      test: (c) => c.haki.includes("observation"),
    },
    {
      id: "haki:armament",
      kind: "haki",
      label: t("Maîtrise le haki de l'armement", "Wields Armament Haki"),
      question: t("Maîtrise-t-il le haki de l'armement ?", "Do they wield Armament Haki?"),
      test: (c) => c.haki.includes("armament"),
    },
    {
      id: "haki:any",
      kind: "haki",
      label: t("Maîtrise au moins un haki", "Wields at least one type of Haki"),
      question: t("Maîtrise-t-il un haki ?", "Do they wield any Haki?"),
      test: (c) => c.haki.length > 0,
    },
    {
      id: "bounty:any",
      kind: "bounty",
      label: t("A une prime connue", "Has a known bounty"),
      question: t("Sa tête est-elle mise à prix ?", "Is there a bounty on their head?"),
      test: (c) => c.bounty !== null,
    },
    {
      id: "bounty:billion",
      kind: "bounty",
      label: t("Prime d'au moins un milliard", "Bounty of at least one billion"),
      question: t("Sa prime atteint-elle le milliard ?", "Does their bounty reach one billion?"),
      test: (c) => (c.bounty ?? 0) >= BILLION,
    },
    {
      id: "bounty:500m",
      kind: "bounty",
      label: t("Prime d'au moins 500 millions", "Bounty of at least 500 million"),
      question: t("Sa prime atteint-elle 500 millions ?", "Does their bounty reach 500 million?"),
      test: (c) => (c.bounty ?? 0) >= 500_000_000,
    },
    {
      id: "bounty:100m",
      kind: "bounty",
      label: t("Prime d'au moins 100 millions", "Bounty of at least 100 million"),
      question: t("Sa prime atteint-elle 100 millions ?", "Does their bounty reach 100 million?"),
      test: (c) => (c.bounty ?? 0) >= 100_000_000,
    },
    {
      id: "gender:female",
      kind: "gender",
      label: t("Personnage féminin", "Female character"),
      question: t("Est-ce une femme ?", "Is the character a woman?"),
      test: (c) => c.gender === "female",
    },
    {
      id: "size:3m",
      kind: "size",
      label: t("Plus de trois mètres", "Over three meters tall"),
      question: t("Mesure-t-il plus de trois mètres ?", "Are they over three meters tall?"),
      test: (c) => (c.height ?? 0) > 300,
    },
    {
      id: "size:5m",
      kind: "size",
      label: t("Plus de cinq mètres", "Over five meters tall"),
      question: t("Mesure-t-il plus de cinq mètres ?", "Are they over five meters tall?"),
      test: (c) => (c.height ?? 0) > 500,
    },
    {
      id: "size:small",
      kind: "size",
      label: t("Moins de 1,70 m", "Under 1.70 m"),
      question: t("Mesure-t-il moins de 1,70 m ?", "Are they under 1.70 m tall?"),
      test: (c) => c.height !== null && c.height < 170,
    },
    {
      id: "age:50",
      kind: "age",
      label: t("Cinquante ans ou plus", "Fifty or older"),
      question: t("A-t-il cinquante ans ou plus ?", "Are they fifty or older?"),
      test: (c) => (c.age ?? 0) >= 50,
    },
    {
      id: "age:70",
      kind: "age",
      label: t("Soixante-dix ans ou plus", "Seventy or older"),
      question: t("A-t-il soixante-dix ans ou plus ?", "Are they seventy or older?"),
      test: (c) => (c.age ?? 0) >= 70,
    },
    {
      id: "age:18",
      kind: "age",
      label: t("Moins de dix-huit ans", "Under eighteen"),
      question: t("A-t-il moins de dix-huit ans ?", "Are they under eighteen?"),
      test: (c) => c.age !== null && c.age < 18,
    },
    {
      id: "age:25",
      kind: "age",
      label: t("Moins de vingt-cinq ans", "Under twenty-five"),
      question: t("A-t-il moins de vingt-cinq ans ?", "Are they under twenty-five?"),
      test: (c) => c.age !== null && c.age < 25,
    },
  );

  for (const [number, title] of data.arcs) {
    all.push({
      id: `arc:${number}`,
      kind: "arc",
      label: t(`Première apparition : arc ${title}`, `First appearance: ${title} arc`),
      question: t(`Apparaît-il pour la première fois dans l'arc ${title} ?`, `Do they first appear in the ${title} arc?`),
      test: (c) => c.arc === number,
    });
  }

  // L'initiale du nom, tel qu'il s'affiche dans la langue du joueur
  const initialOf = (c: PlayCharacter) => normalizeText(c.name)[0]?.toUpperCase();
  for (const letter of [...new Set(data.characters.map(initialOf))].filter((l): l is string => !!l && /[A-Z]/.test(l)).sort()) {
    all.push({
      id: `initial:${letter}`,
      kind: "initial",
      label: t(`Nom commençant par ${letter}`, `Name starting with ${letter}`),
      question: t(`Son nom commence-t-il par la lettre ${letter} ?`, `Does their name start with the letter ${letter}?`),
      test: (c) => initialOf(c) === letter,
    });
  }

  const useful = all.filter((criterion) => data.characters.filter(criterion.test).length >= 4);
  built.set(data, useful);
  return useful;
}
