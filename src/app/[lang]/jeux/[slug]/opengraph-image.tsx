import { formatNumber } from "@/games/engine/text";
import { BASE_BERRYS, DAILY_CHALLENGE_BERRYS } from "@/lib/economy";
import { GAME_CATEGORIES, getGame, isLiveSlug, isRewardless, LIVE_SLUGS } from "@/lib/games/catalog";
import { DEFAULT_LOCALE, INTL_LOCALES, isLocale, translator } from "@/lib/i18n";
import { ogCard, OG_SIZE } from "@/lib/og/card";
import { OG_TONES } from "@/lib/og/tones";

export const alt = "One Piece mini-game";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return LIVE_SLUGS.map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const t = translator(locale);
  const game = getGame(slug);
  if (!game || !isLiveSlug(slug)) {
    return ogCard({ locale, title: t("Mini-jeu One Piece", "One Piece mini-game"), subtitle: "", mark: "?", bounty: t("À jouer", "Play now") });
  }

  // La « prime » de l'avis : ce que rapporte le jeu quand il est à l'affiche
  const berrys = slug === "onepiecedle" ? DAILY_CHALLENGE_BERRYS : BASE_BERRYS[slug];
  // L'espace insécable fin de formatNumber n'est pas dans les polices embarquées : une espace simple
  const amount = formatNumber(berrys, locale).replace(/\s/g, " ");
  return ogCard({
    locale,
    title: game.title[locale],
    subtitle: game.pitch[locale],
    eyebrow:
      slug === "onepiecedle"
        ? t("Le défi du jour", "The daily challenge")
        : GAME_CATEGORIES.find((category) => category.id === game.category)?.title[locale],
    tone: OG_TONES[game.category],
    mark: game.title[locale].charAt(0).toLocaleUpperCase(INTL_LOCALES[locale]),
    bounty: isRewardless(slug) ? t("Pour le plaisir", "Just for fun") : t(`${amount} Berrys`, `${amount} Berries`),
  });
}
