import { GAMES } from "@/lib/games/catalog";
import { DEFAULT_LOCALE, isLocale, translator } from "@/lib/i18n";
import { ogCard, OG_SIZE } from "@/lib/og/card";
import { SITE_NAME } from "@/lib/site";

export const alt = SITE_NAME;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const t = translator(locale);
  const live = GAMES.filter((game) => game.status === "live").length;
  return ogCard({
    locale,
    title: t("Les mini-jeux\nOne Piece", "One Piece\nmini-games"),
    subtitle: t(
      "Primes, fruits du démon, équipages : des parties courtes, et six jeux du jour à valider.",
      "Bounties, Devil Fruits, crews: quick games, and six daily games to clear.",
    ),
    mark: "?",
    bounty: t(`${live} jeux`, `${live} games`),
  });
}
