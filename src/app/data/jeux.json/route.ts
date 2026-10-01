import { buildGameData } from "@/games/cards";

// Généré une fois à la compilation, puis servi comme un fichier statique.
export const dynamic = "force-static";

export function GET() {
  // Un fichier de données, pas une page : il n'a rien à faire dans les résultats de recherche
  return Response.json(buildGameData(), { headers: { "X-Robots-Tag": "noindex" } });
}
