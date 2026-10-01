import { buildGameData } from "@/games/cards";

// Généré une fois à la compilation, puis servi comme un fichier statique.
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildGameData());
}
