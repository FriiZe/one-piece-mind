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
