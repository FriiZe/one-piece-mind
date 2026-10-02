"use client";

import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, localePath, type Locale } from "@/lib/i18n";
import { useLocale, usePath, useT } from "@/lib/i18n/client";

/** Retient la langue choisie : elle prime ensuite sur celle du navigateur (voir src/proxy.ts). */
function rememberLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Sélecteur de langue : la même page, dans l'autre langue. De vrais liens,
 * pour que les moteurs de recherche suivent aussi le passage d'une langue à l'autre.
 *
 * `className` fixe l'affichage (`inline-flex` par défaut) : écrit ici en dur, il l'emporterait
 * sur le `hidden` de l'en-tête, et le sélecteur s'y afficherait aussi sur téléphone.
 */
export function LanguageSwitch({ className = "inline-flex" }: { className?: string }) {
  const current = useLocale();
  const path = usePath();
  const t = useT();

  return (
    <span role="group" aria-label={t("Langue du site", "Site language")} className={`items-center gap-1 text-[13px] font-bold ${className}`}>
      {LOCALES.map((locale) => (
        // Un lien classique : la page entière est rechargée dans l'autre langue, données des jeux comprises
        <a
          key={locale}
          href={localePath(locale, path)}
          hrefLang={locale}
          lang={locale}
          aria-label={LOCALE_NAMES[locale]}
          aria-current={locale === current ? "true" : undefined}
          onClick={() => rememberLocale(locale)}
          className={`rounded-md px-2 py-1 uppercase transition-colors ${
            locale === current ? "bg-sea-700 text-foam" : "text-mist hover:text-foam"
          }`}
        >
          {locale}
        </a>
      ))}
    </span>
  );
}
