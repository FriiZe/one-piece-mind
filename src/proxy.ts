import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, localePath, preferredLocale, splitLocale } from "@/lib/i18n";

/**
 * Routage des langues. Les pages vivent sous `src/app/[lang]` ; le français,
 * langue par défaut, est servi sans préfixe :
 *
 * - `/jeux` est rendu par `/fr/jeux`, sans que l'adresse change ;
 * - `/fr/jeux` renvoie vers `/jeux`, pour qu'une page n'ait qu'une adresse ;
 * - `/en/jeux` passe tel quel.
 *
 * Un visiteur qui arrive sur une adresse française sans avoir jamais choisi de
 * langue est envoyé vers la version de la langue de son navigateur. Son choix
 * dans le sélecteur (cookie) prime ensuite.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();

  const prefix = `/${DEFAULT_LOCALE}`;
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    // Les images de partage sont publiées par Next sous leur adresse interne : on les sert sans détour
    if (pathname.includes("/opengraph-image")) return NextResponse.next();
    url.pathname = pathname.slice(prefix.length) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (splitLocale(pathname).locale !== DEFAULT_LOCALE) return NextResponse.next();

  if (isPageVisit(request) && !isLocale(request.cookies.get(LOCALE_COOKIE)?.value)) {
    const locale = preferredLocale(request.headers.get("accept-language"));
    if (locale !== DEFAULT_LOCALE) {
      url.pathname = localePath(locale, pathname);
      return NextResponse.redirect(url, 307);
    }
  }

  url.pathname = `${prefix}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

/**
 * Un visiteur ouvre-t-il une page dans son navigateur ? Les données des jeux,
 * les navigations internes (qui restent dans la langue en cours) et les
 * actions envoyées au serveur ne sont jamais redirigées : ce sont des requêtes
 * lancées par le site, qui ne demandent pas de page HTML.
 */
function isPageVisit(request: NextRequest): boolean {
  if (request.method !== "GET") return false;
  const destination = request.headers.get("sec-fetch-dest");
  if (destination && destination !== "document") return false;
  return (request.headers.get("accept") ?? "").includes("text/html");
}

export const config = {
  // Tout, sauf l'API, les fichiers de Next, les images du site et les fichiers servis à la racine
  matcher: ["/((?!api/|_next/|images/|icon\\.svg|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)"],
};
