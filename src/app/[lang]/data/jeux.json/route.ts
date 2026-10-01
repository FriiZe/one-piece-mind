import { buildGameData } from "@/games/cards";
import { isLocale, LOCALES } from "@/lib/i18n";

// Généré une fois par langue à la compilation, puis servi comme un fichier statique.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/data/jeux.json">) {
  const { lang } = await params;
  if (!isLocale(lang)) return new Response(null, { status: 404 });
  return Response.json(buildGameData(lang));
}
