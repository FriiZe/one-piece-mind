import { ogCard, OG_SIZE } from "@/lib/og/card";
import { getGame, LIVE_SLUGS } from "@/lib/games/catalog";

export const alt = "Mini-jeu One Piece";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return LIVE_SLUGS.map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getGame(slug);
  return ogCard({ title: game?.title ?? "Mini-jeu One Piece", subtitle: game?.pitch ?? "" });
}
