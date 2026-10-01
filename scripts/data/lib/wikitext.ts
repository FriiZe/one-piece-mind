/**
 * Lecture minimale du wikitext du wiki One Piece : extraction d'un modèle
 * (infobox) et nettoyage de ses valeurs.
 */

/** Renvoie les paramètres nommés du premier modèle `{{name ...}}` trouvé. */
export function extractTemplate(text: string, name: string): Record<string, string> | null {
  const start = text.search(new RegExp(`\\{\\{\\s*${name.replace(/ /g, "[ _]")}\\s*[|\\n]`, "i"));
  if (start === -1) return null;

  const params: Record<string, string> = {};
  let depth = 0;
  let linkDepth = 0;
  let current = "";
  const parts: string[] = [];

  for (let i = start; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === "{{") {
      depth++;
      if (depth > 1) current += two;
      i++;
    } else if (two === "}}") {
      depth--;
      if (depth === 0) {
        parts.push(current);
        break;
      }
      current += two;
      i++;
    } else if (two === "[[") {
      linkDepth++;
      current += two;
      i++;
    } else if (two === "]]") {
      linkDepth = Math.max(0, linkDepth - 1);
      current += two;
      i++;
    } else if (text[i] === "|" && depth === 1 && linkDepth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += text[i];
    }
  }

  // parts[0] est le nom du modèle
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    if (key) params[key] = part.slice(eq + 1).trim();
  }
  return params;
}

/** Supprime les modèles imbriqués (références, etc.) en conservant le texte utile. */
export function stripTemplates(value: string): string {
  let out = value;
  let previous: string;
  do {
    previous = out;
    // {{Nihongo|Texte|...}} → Texte ; {{B}} → rien ; les autres modèles disparaissent
    out = out.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) => {
      const [name, first] = inner.split("|");
      const n = name.trim().toLowerCase();
      if (n === "nihongo" || n === "ruby" || n === "w") return (first ?? "").trim();
      return "";
    });
  } while (out !== previous);
  return out;
}

/** Texte lisible : sans modèles, liens réduits à leur libellé, sans balises ni mise en forme. */
export function cleanValue(value: string): string {
  return stripTemplates(value)
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/'{2,}/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Cibles des liens `[[Cible|libellé]]` d'une valeur. */
export function linkTargets(value: string): string[] {
  return [...value.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map((m) => m[1].trim());
}

/** Remplace chaque modèle `{{name ...}}` (accolades imbriquées comprises) par `fn(contenu)`. */
export function mapTemplates(text: string, name: string, fn: (inner: string) => string): string {
  const open = new RegExp(`\\{\\{\\s*${name}\\s*(?=[|}])`, "gi");
  let out = "";
  let cursor = 0;
  for (let match = open.exec(text); match; match = open.exec(text)) {
    let depth = 0;
    let end = -1;
    for (let i = match.index; i < text.length - 1; i++) {
      const two = text.slice(i, i + 2);
      if (two === "{{") {
        depth++;
        i++;
      } else if (two === "}}") {
        depth--;
        i++;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1) break;
    out += text.slice(cursor, match.index) + fn(text.slice(match.index + 2, end - 2));
    cursor = end;
    open.lastIndex = end;
  }
  return out + text.slice(cursor);
}

const REF_OPEN = "⟦";
const REF_CLOSE = "⟧";
const REF_TOKEN = new RegExp(`${REF_OPEN}([^${REF_CLOSE}]*)${REF_CLOSE}`, "g");

function qrefParts(inner: string) {
  const name = inner.match(/\|\s*name\s*=\s*([^|]+)/i)?.[1].trim().toLowerCase() ?? null;
  const chap = inner.match(/\|\s*chap\s*=\s*(\d+)/i)?.[1];
  // Source hors manga : film, épisode spécial, jeu, roman
  const offCanon = /\|\s*(movie|special|game|novel|ova)\s*=/i.test(inner);
  return { name, chapter: chap ? Number(chap) : null, offCanon };
}

/**
 * Références nommées d'une infobox : `{{Qref|name=x|chap=12}}` est défini une
 * fois puis rappelé ailleurs par `{{Qref|name=x}}`.
 */
export function collectNamedRefs(params: Record<string, string>): Map<string, number> {
  const refs = new Map<string, number>();
  for (const value of Object.values(params)) {
    mapTemplates(value, "qref", (inner) => {
      const { name, chapter } = qrefParts(inner);
      if (name && chapter !== null && !refs.has(name)) refs.set(name, chapter);
      return "";
    });
  }
  return refs;
}

export type Entry = {
  /** Texte nettoyé de l'entrée. */
  text: string;
  /** Chapitre le plus ancien cité en référence, `null` si aucun. */
  since: number | null;
  /** Entrée sourcée uniquement par un film, un spécial, un jeu ou un roman. */
  offCanon: boolean;
};

/**
 * Découpe une valeur d'infobox en entrées (séparées par `;`, `<br>` ou un saut
 * de ligne) et rattache à chacune le chapitre de ses références.
 */
export function parseEntries(value: string, refs: Map<string, number>): Entry[] {
  let v = value.replace(/<!--[\s\S]*?-->/g, "");
  v = mapTemplates(v, "qref", (inner) => {
    const { name, chapter, offCanon } = qrefParts(inner);
    // Convention du wiki : une référence nommée « c1058 » renvoie au chapitre 1058
    const resolved = chapter ?? (name ? (refs.get(name) ?? Number(name.match(/^c(\d+)/)?.[1] ?? NaN)) : NaN);
    return `${REF_OPEN}${Number.isFinite(resolved) ? resolved : offCanon ? "x" : "?"}${REF_CLOSE}`;
  });
  // Une référence placée juste après un « ; » documente l'entrée qui précède
  v = v.replace(new RegExp(`;((?:\\s*${REF_OPEN}[^${REF_CLOSE}]*${REF_CLOSE})+)`, "g"), "$1;");

  const entries: Entry[] = [];
  for (const raw of v.split(/<br\s*\/?>|\n|;/gi)) {
    const tokens = [...raw.matchAll(REF_TOKEN)].map((m) => m[1]);
    const chapters = tokens.map(Number).filter(Number.isFinite);
    const text = cleanValue(raw.replace(REF_TOKEN, "")).replace(/^\*\s*/, "");
    if (!text) continue;
    entries.push({
      text,
      since: chapters.length ? Math.min(...chapters) : null,
      offCanon: !chapters.length && tokens.includes("x"),
    });
  }
  return entries;
}
