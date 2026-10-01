/**
 * Critères : des propriétés que l'on peut vérifier sur un personnage (« vient
 * d'East Blue », « maîtrise le haki des rois »). Ils servent aux jeux qui
 * classent ou recoupent des personnages : Connexions, Grille 3×3, Den Den Devin.
 * Tout part des données déjà ramenées au mode du joueur : aucun critère ne
 * peut révéler ce qu'il n'a pas encore vu.
 */
import type { PlayCharacter, ResolvedData } from "../cards";
import { RACE_LABELS, SEA_LABELS } from "@/lib/data/labels";
import { RACES, SEAS } from "@/lib/data/schema";

export type CriterionKind = "affiliation" | "group" | "sea" | "race" | "fruit" | "haki" | "bounty" | "arc" | "gender" | "size" | "age";

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

  const zoan = (c: PlayCharacter) => !!c.fruitId && !!data.fruitById.get(c.fruitId)?.type.startsWith("zoan");
  const fruitType = (c: PlayCharacter) => (c.fruitId ? data.fruitById.get(c.fruitId)?.type : undefined);
  const all: Criterion[] = [];

  const affiliations = new Map<string, number>();
  for (const c of data.characters) if (c.affiliation) affiliations.set(c.affiliation, (affiliations.get(c.affiliation) ?? 0) + 1);
  for (const [affiliation] of affiliations) {
    all.push({
      id: `affiliation:${affiliation}`,
      kind: "affiliation",
      label: affiliation,
      question: `Son affiliation principale est-elle : ${affiliation} ?`,
      test: (c) => c.affiliation === affiliation,
    });
  }

  for (const group of data.groups) {
    const members = new Set(group.memberIds);
    all.push({
      id: `group:${group.id}`,
      kind: "group",
      label: group.title,
      question: `Fait-il partie de ce groupe : ${group.title} ?`,
      test: (c) => members.has(c.id),
    });
  }

  for (const sea of SEAS) {
    all.push({
      id: `sea:${sea}`,
      kind: "sea",
      label: `Origine : ${SEA_LABELS[sea]}`,
      question: `Vient-il de : ${SEA_LABELS[sea]} ?`,
      test: (c) => c.sea === sea,
    });
  }

  for (const race of RACES) {
    all.push({
      id: `race:${race}`,
      kind: "race",
      label: `Race : ${RACE_LABELS[race]}`,
      question: `Est-il de cette race : ${RACE_LABELS[race]} ?`,
      test: (c) => c.races.includes(race),
    });
  }

  all.push(
    { id: "fruit:any", kind: "fruit", label: "A mangé un fruit du démon", question: "A-t-il mangé un fruit du démon ?", test: (c) => !!c.fruitId },
    { id: "fruit:logia", kind: "fruit", label: "Fruit de type Logia", question: "Son fruit est-il un Logia ?", test: (c) => fruitType(c) === "logia" },
    { id: "fruit:zoan", kind: "fruit", label: "Fruit de type Zoan", question: "Son fruit est-il un Zoan ?", test: zoan },
    {
      id: "fruit:paramecia",
      kind: "fruit",
      label: "Fruit de type Paramecia",
      question: "Son fruit est-il un Paramecia ?",
      test: (c) => fruitType(c) === "paramecia",
    },
    {
      id: "haki:conqueror",
      kind: "haki",
      label: "Maîtrise le haki des rois",
      question: "Maîtrise-t-il le haki des rois ?",
      test: (c) => c.haki.includes("conqueror"),
    },
    { id: "haki:any", kind: "haki", label: "Maîtrise au moins un haki", question: "Maîtrise-t-il un haki ?", test: (c) => c.haki.length > 0 },
    { id: "bounty:any", kind: "bounty", label: "A une prime connue", question: "Sa tête est-elle mise à prix ?", test: (c) => c.bounty !== null },
    {
      id: "bounty:billion",
      kind: "bounty",
      label: "Prime d'au moins un milliard",
      question: "Sa prime atteint-elle le milliard ?",
      test: (c) => (c.bounty ?? 0) >= BILLION,
    },
    {
      id: "bounty:100m",
      kind: "bounty",
      label: "Prime d'au moins 100 millions",
      question: "Sa prime atteint-elle 100 millions ?",
      test: (c) => (c.bounty ?? 0) >= 100_000_000,
    },
    { id: "gender:female", kind: "gender", label: "Personnage féminin", question: "Est-ce une femme ?", test: (c) => c.gender === "female" },
    { id: "size:3m", kind: "size", label: "Plus de trois mètres", question: "Mesure-t-il plus de trois mètres ?", test: (c) => (c.height ?? 0) > 300 },
    { id: "size:small", kind: "size", label: "Moins de 1,70 m", question: "Mesure-t-il moins de 1,70 m ?", test: (c) => c.height !== null && c.height < 170 },
    { id: "age:50", kind: "age", label: "Cinquante ans ou plus", question: "A-t-il cinquante ans ou plus ?", test: (c) => (c.age ?? 0) >= 50 },
    { id: "age:25", kind: "age", label: "Moins de vingt-cinq ans", question: "A-t-il moins de vingt-cinq ans ?", test: (c) => c.age !== null && c.age < 25 },
  );

  for (const [number, title] of data.arcs) {
    all.push({
      id: `arc:${number}`,
      kind: "arc",
      label: `Première apparition : arc ${title}`,
      question: `Apparaît-il pour la première fois dans l'arc ${title} ?`,
      test: (c) => c.arc === number,
    });
  }

  const useful = all.filter((criterion) => data.characters.filter(criterion.test).length >= 4);
  built.set(data, useful);
  return useful;
}
