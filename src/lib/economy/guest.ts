import type { PlayerState, Reward } from "./types";

/**
 * Jouer sans compte sert à essayer le site, pas à y faire fortune : la progression d'un invité vit
 * dans son navigateur, où tout peut s'écrire à la main. Un invité gagne donc des Berrys jusqu'à un
 * plafond, pas de prime, et ses recrues restent scellées jusqu'à ce qu'il crée un compte, où elles
 * sont alors tirées par le serveur. Il n'achète rien non plus.
 */
export const GUEST_BERRY_CAP = 10_000;
/** Recrues scellées qu'un compte neuf reçoit au plus de son passé d'invité. */
export const GUEST_RECRUITS_MAX = 20;

/**
 * Ramène une partie jouée en invité dans ses limites : le solde ne dépasse pas le plafond (sans
 * baisser s'il le dépassait déjà), la prime ne bouge pas, et une recrue gagnée est mise sous scellés
 * au lieu de rejoindre la collection. `capped` dit si des Berrys ont été retenus.
 */
export function limitGuestGame(before: PlayerState, after: PlayerState, reward: Reward): { state: PlayerState; reward: Reward; capped: boolean } {
  const room = Math.max(0, GUEST_BERRY_CAP - before.berrys);
  const gained = after.berrys - before.berrys;
  const kept = Math.min(gained, room);
  const state: PlayerState = {
    ...after,
    berrys: before.berrys + kept,
    lifetimeBerrys: before.lifetimeBerrys,
    collection: reward.recruit ? before.collection : after.collection,
    pendingRecruits: before.pendingRecruits + (reward.recruit ? 1 : 0),
  };
  return { state, reward: { ...reward, guestCapped: kept < gained }, capped: kept < gained };
}

/** Un invité qui a atteint le plafond : chaque jeu commence par lui rappeler que ses Berrys l'attendent sur un compte. */
export const guestAtCap = (state: PlayerState) => state.berrys >= GUEST_BERRY_CAP;
