"use client";

import type { PlayCharacter } from "../cards";
import { Portrait } from "./Portrait";
import { useT } from "@/lib/i18n/client";

/**
 * Propositions manquées sur la manche en cours, dans l'ordre où elles ont été
 * tentées : le joueur voit qui il a déjà écarté. Rien ne s'affiche tant qu'il
 * ne s'est pas trompé.
 */
export function GuessHistory({
  ids,
  characterById,
}: {
  ids: readonly string[];
  characterById: ReadonlyMap<string, PlayCharacter>;
}) {
  const t = useT();
  if (!ids.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold tracking-wide text-mist uppercase">{t("Déjà proposés", "Already guessed")}</p>
      <ol className="flex flex-wrap gap-2" aria-live="polite">
        {ids.map((id, index) => {
          const character = characterById.get(id);
          if (!character) return null;
          return (
            <li
              key={id}
              className={`flex items-center gap-2 rounded-lg border border-vest/50 bg-sea-800/70 py-1 pr-3 text-sm font-semibold ${character.img ? "pl-1" : "pl-3"}`}
            >
              {character.img && <Portrait img={character.img} className="h-9 w-7 shrink-0" />}
              <span className="text-mist">{index + 1}.</span>
              <span className="text-foam line-through decoration-vest">{character.name}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
