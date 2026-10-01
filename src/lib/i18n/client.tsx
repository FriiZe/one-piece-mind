"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, localePath, splitLocale, translator, type Locale, type Translate } from ".";

const Context = createContext<Locale>(DEFAULT_LOCALE);

/** Donne la langue de la page à toute l'interface : posé une fois, dans le layout. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Context.Provider value={locale}>{children}</Context.Provider>;
}

export function useLocale(): Locale {
  return useContext(Context);
}

/** `const t = useT()` puis `t("Jouer", "Play")`. */
export function useT(): Translate {
  const locale = useLocale();
  return useMemo(() => translator(locale), [locale]);
}

/** Adresse d'une page dans la langue en cours, pour `router.push` et les liens à partager. */
export function useLocalePath(): (path: string) => string {
  const locale = useLocale();
  return useCallback((path: string) => localePath(locale, path), [locale]);
}

/** Chemin de la page sans le préfixe de langue : `/jeux` sur `/jeux` comme sur `/en/jeux`. */
export function usePath(): string {
  return splitLocale(usePathname()).path;
}
