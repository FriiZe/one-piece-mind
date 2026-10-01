import { ogCard, OG_SIZE } from "@/lib/og/card";
import { GAMES } from "@/lib/games/catalog";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  const live = GAMES.filter((game) => game.status === "live").length;
  return ogCard({
    title: "Les mini-jeux\nOne Piece",
    subtitle: "Primes, fruits du démon, équipages : des parties courtes, et six jeux du jour à valider.",
    mark: "?",
    bounty: `${live} jeux`,
  });
}
