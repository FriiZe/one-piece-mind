import type { GameData, ResolvedData } from "../cards";

/** Ce que reçoit chaque jeu : les données filtrées selon le mode du joueur, et les données complètes. */
export type GameProps = { data: ResolvedData; raw: GameData };
