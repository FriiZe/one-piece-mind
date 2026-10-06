/** Page publique d'un joueur : ce qu'en sait l'interface. */
import type { CollectionEntry, PlayerLook, PostId } from "@/lib/economy";

export type PlayerProfile = {
  id: string;
  username: string;
  createdAt: number;
  games: number;
  lifetimeBerrys: number;
  look: PlayerLook;
  /** Classé : cote de la saison en cours, `null` tant qu'il n'y a pas joué. */
  rating: number | null;
  crew: Partial<Record<PostId, string>>;
  /** Avis de recherche visibles dans le mode spoiler du visiteur. */
  collection: Record<string, CollectionEntry>;
  /** Nombre d'avis différents que le visiteur peut voir dans son mode. */
  known: number;
  /**
   * Le lien entre le visiteur et ce joueur : `self` c'est lui, `guest` le visiteur n'a pas de compte,
   * `sent` et `received` une demande d'ami en attente, dans un sens ou dans l'autre.
   */
  friendship: "self" | "guest" | "none" | "friends" | "sent" | "received";
  /** Identifiant de la demande en attente, pour y répondre ou la retirer. */
  requestId: string | null;
};
