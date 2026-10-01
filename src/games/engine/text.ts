/** Comparaison tolérante des réponses saisies : casse, accents et ponctuation ignorés. */

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "oe")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Un texte donné en indice contient-il un mot du nom à trouver ?
 * (« Arc Arlong Park » ou « Équipage d'Arlong » quand il faut trouver Arlong.)
 */
export function revealsName(text: string, name: string): boolean {
  const shown = normalizeText(text).split(" ");
  return normalizeText(name)
    .split(" ")
    .some((word) => word.length >= 3 && shown.includes(word));
}

/** Nombre de lettres à ajouter, retirer ou remplacer pour passer d'un texte à l'autre. */
export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Une réponse tapée sans proposition désigne-t-elle l'une des réponses
 * acceptées ? Une faute de frappe est tolérée sur une réponse moyenne, deux
 * sur une longue ; les chiffres, eux, doivent être exacts (« Gear 4 » n'est
 * pas « Gear 5 »). `rejected` : les mauvaises réponses connues. Une saisie
 * aussi proche de l'une d'elles que de la bonne n'est pas acceptée (« West
 * Blue » n'est pas une faute de frappe d'« East Blue »).
 */
export function matchesAnswer(input: string, accepted: readonly string[], rejected: readonly string[] = []): boolean {
  const typed = normalizeText(input);
  if (!typed) return false;
  const digits = (text: string) => text.replace(/\D/g, "");
  const targets = accepted.map(normalizeText).filter(Boolean);
  if (targets.includes(typed)) return true;

  let best = Infinity;
  for (const target of targets) {
    const tolerance = target.length >= 12 ? 2 : target.length >= 6 ? 1 : 0;
    if (tolerance === 0 || digits(typed) !== digits(target)) continue;
    const distance = editDistance(typed, target);
    if (distance <= tolerance) best = Math.min(best, distance);
  }
  if (best === Infinity) return false;
  return rejected.every((form) => editDistance(typed, normalizeText(form)) > best);
}

type Named = { name: string; altName?: string | null; aliases: string[] };

/** Toutes les graphies normalisées sous lesquelles un personnage peut être saisi. */
export function nameForms(entity: Named): string[] {
  const forms = [entity.name, entity.altName, ...entity.aliases]
    .filter((form): form is string => !!form)
    .flatMap((form) => form.split(/\n|;/))
    .map(normalizeText)
    .filter(Boolean);
  return [...new Set(forms)];
}

/**
 * Recherche pour la saisie assistée : les noms qui commencent par la saisie
 * d'abord, puis ceux dont un mot commence par elle, puis ceux qui la contiennent.
 */
export function searchByName<T extends Named>(items: readonly T[], query: string, limit = 8): T[] {
  const q = normalizeText(query);
  if (!q) return [];
  const ranked: { item: T; rank: number }[] = [];
  for (const item of items) {
    let best = Infinity;
    for (const form of nameForms(item)) {
      if (form.startsWith(q)) best = Math.min(best, 0);
      else if (form.split(" ").some((word) => word.startsWith(q))) best = Math.min(best, 1);
      else if (form.includes(q)) best = Math.min(best, 2);
    }
    if (best !== Infinity) ranked.push({ item, rank: best });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name, "fr"))
    .slice(0, limit)
    .map((r) => r.item);
}

const numberFormat = new Intl.NumberFormat("fr-FR");

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatBounty(value: number | null): string {
  return value === null ? "Aucune" : `${formatNumber(value)} ฿`;
}

export function formatHeight(cm: number | null): string {
  if (cm === null) return "Inconnue";
  return cm >= 1000 ? `${formatNumber(Math.round(cm / 10) / 10)} m` : `${formatNumber(cm)} cm`;
}
