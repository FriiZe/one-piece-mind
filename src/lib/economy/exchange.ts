import type { Localized } from "@/lib/i18n";

/**
 * Échanges et marché font passer des avis et des Berrys d'un compte à l'autre. Sans garde-fou, un
 * compte créé pour l'occasion sert de réservoir : inscription, un booster, un échange vers le compte
 * principal, et on recommence. Ils ne s'ouvrent donc qu'aux comptes qui ont joué plusieurs jours.
 *
 * Le critère est le nombre de jours différents où le serveur a validé une partie. Ni la prime ni la
 * collection ne conviendraient : elles se reprennent d'un état d'invité, que le navigateur déclare.
 */
export const EXCHANGE_MIN_PLAY_DAYS = 3;

export type ExchangeAccess = {
  open: boolean;
  /** Jours différents où le joueur a terminé au moins une partie avec son compte. */
  playDays: number;
  required: number;
};

export const exchangeAccess = (playDays: number): ExchangeAccess => ({
  open: playDays >= EXCHANGE_MIN_PLAY_DAYS,
  playDays,
  required: EXCHANGE_MIN_PLAY_DAYS,
});

/** Ce qu'il reste à faire à un joueur pour que les échanges et le marché s'ouvrent. */
export function exchangeLockNote(access: ExchangeAccess): Localized {
  const left = Math.max(0, access.required - access.playDays);
  return {
    fr: `Les échanges et le marché s'ouvrent aux comptes qui ont joué ${access.required} jours différents. Tu en es à ${access.playDays} : termine une partie ${left > 1 ? `${left} autres jours` : "un autre jour"}, et ce sera ouvert.`,
    en: `Trades and the market open to accounts that have played on ${access.required} different days. You're at ${access.playDays}: finish a game on ${left > 1 ? `${left} more days` : "one more day"}, and they'll be open.`,
  };
}
