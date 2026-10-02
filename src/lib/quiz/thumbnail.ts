import { QUIZ_THUMBNAIL } from "./rules";

/** Qualités essayées tour à tour : la première qui tient dans la limite de taille est gardée. */
const QUALITIES = [0.82, 0.65, 0.45];

/**
 * Vignette d'un quiz à partir d'une image choisie par le joueur : recadrée au centre, réduite aux
 * dimensions de `QUIZ_THUMBNAIL` et encodée en JPEG, sous forme d'URL de données. Tout se fait dans
 * le navigateur : seule l'image réduite est envoyée. `null` si le fichier n'est pas une image lisible.
 */
export async function toThumbnail(file: File): Promise<string | null> {
  const { width, height, maxBytes, prefix } = QUIZ_THUMBNAIL;
  const image = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!image) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  // L'image couvre tout le cadre : ce qui dépasse, en haut et en bas ou sur les côtés, est coupé
  const scale = Math.max(width / image.width, height / image.height);
  const drawn = { width: image.width * scale, height: image.height * scale };
  // Un fond pour les images transparentes : le JPEG n'a pas de transparence
  context.fillStyle = "#12283f";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, (width - drawn.width) / 2, (height - drawn.height) / 2, drawn.width, drawn.height);
  image.close();

  for (const quality of QUALITIES) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    // En base 64, quatre caractères portent trois octets
    if (dataUrl.startsWith(prefix) && ((dataUrl.length - prefix.length) * 3) / 4 <= maxBytes) return dataUrl;
  }
  return null;
}
