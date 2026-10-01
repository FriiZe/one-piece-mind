import { ogCard, OG_SIZE } from "@/lib/og/card";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({ title: "Les mini-jeux One Piece", subtitle: "Gratuits, sans inscription, sans spoiler" });
}
