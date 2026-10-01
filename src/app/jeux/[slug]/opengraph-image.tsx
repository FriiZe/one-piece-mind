import { formatNumber } from "@/games/engine/text";
import { BASE_BERRYS, DAILY_CHALLENGE_BERRYS } from "@/lib/economy";
import { GAME_CATEGORIES, getGame, isLiveSlug, isRewardless, LIVE_SLUGS } from "@/lib/games/catalog";
import { ogCard, OG_SIZE } from "@/lib/og/card";
import { OG_TONES } from "@/lib/og/tones";

export const alt = "Mini-jeu One Piece";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return LIVE_SLUGS.map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game || !isLiveSlug(slug)) return ogCard({ title: "Mini-jeu One Piece", subtitle: "", mark: "?", bounty: "À jouer" });

  // La « prime » de l'avis : ce que rapporte le jeu quand il est à l'affiche
  const berrys = slug === "onepiecedle" ? DAILY_CHALLENGE_BERRYS : BASE_BERRYS[slug];
  return ogCard({
    title: game.title,
    subtitle: game.pitch,
    eyebrow: slug === "onepiecedle" ? "Le défi du jour" : GAME_CATEGORIES.find((category) => category.id === game.category)?.title,
    tone: OG_TONES[game.category],
    mark: game.title.charAt(0).toLocaleUpperCase("fr"),
    // L'espace insécable fin de formatNumber n'est pas dans les polices embarquées : une espace simple
    bounty: isRewardless(slug) ? "Pour le plaisir" : `${formatNumber(berrys).replace(/\s/g, " ")} Berrys`,
  });
}
