import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { isLocale, translator, type Locale, type Translate } from ".";

/** Langue de la page en cours de rendu, d'après le segment `[lang]` de son adresse. */
export async function getLocale(): Promise<Locale> {
  const locale = await lang();
  if (!isLocale(locale)) notFound();
  return locale;
}

/** `const t = await getT()` puis `t("Jouer", "Play")`, dans un composant serveur. */
export async function getT(): Promise<Translate> {
  return translator(await getLocale());
}
