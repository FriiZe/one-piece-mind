/**
 * Génère les silhouettes des jeux « à l'œil » : chaque portrait détouré (PNG à
 * fond transparent) devient une forme noire de mêmes dimensions.
 *
 * Usage : npm run images:silhouettes [dossier source] [dossier cible]
 * Par défaut : assets/portraits → public/silhouettes
 */
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

/** Opacité (0-255) à partir de laquelle un pixel fait partie du personnage. */
const ALPHA_THRESHOLD = 96;
/** Part minimale de pixels transparents pour considérer le portrait comme détouré. */
const MIN_TRANSPARENT_RATIO = 0.05;

export type SilhouetteResult = { ok: true } | { ok: false; reason: string };

export async function makeSilhouette(source: string, target: string): Promise<SilhouetteResult> {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  let transparent = 0;
  for (let i = 0; i < data.length; i += 4) {
    const solid = data[i + 3] >= ALPHA_THRESHOLD;
    if (!solid) transparent++;
    data[i] = data[i + 1] = data[i + 2] = 0;
    data[i + 3] = solid ? 255 : 0;
  }

  const pixels = info.width * info.height;
  if (transparent / pixels < MIN_TRANSPARENT_RATIO) {
    return { ok: false, reason: "portrait non détouré (fond opaque)" };
  }
  if (transparent === pixels) return { ok: false, reason: "image entièrement transparente" };

  await mkdir(path.dirname(target), { recursive: true });
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9, palette: true })
    .toFile(target);
  return { ok: true };
}

async function main() {
  const root = path.resolve(import.meta.dirname, "../..");
  const sourceDir = path.resolve(root, process.argv[2] ?? "assets/portraits");
  const targetDir = path.resolve(root, process.argv[3] ?? "public/silhouettes");

  const files = await readdir(sourceDir).catch(() => null);
  if (!files) {
    console.error(`Dossier source introuvable : ${sourceDir}`);
    process.exit(1);
  }

  let done = 0;
  for (const file of files.filter((f) => /\.(png|webp)$/i.test(f))) {
    const target = path.join(targetDir, `${path.parse(file).name}.png`);
    const result = await makeSilhouette(path.join(sourceDir, file), target);
    if (result.ok) done++;
    else console.warn(`${file} ignoré : ${result.reason}`);
  }
  console.log(`${done} silhouette(s) écrite(s) dans ${targetDir}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
