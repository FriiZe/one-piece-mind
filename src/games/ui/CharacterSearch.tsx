"use client";

import { useId, useMemo, useState } from "react";
import type { PlayCharacter } from "../cards";
import { searchByName } from "../engine/text";
import { useT } from "@/lib/i18n/client";

/** Champ de saisie assistée : le joueur tape un nom et choisit dans la liste. */
export function CharacterSearch({
  characters,
  excludeIds,
  onPick,
  label,
  placeholder,
  disabled = false,
}: {
  characters: readonly PlayCharacter[];
  excludeIds?: ReadonlySet<string>;
  onPick: (character: PlayCharacter) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = useMemo(() => {
    const pool = excludeIds ? characters.filter((c) => !excludeIds.has(c.id)) : characters;
    return searchByName(pool, query);
  }, [characters, excludeIds, query]);
  const highlighted = Math.min(active, Math.max(0, results.length - 1));

  function choose(character: PlayCharacter) {
    onPick(character);
    setQuery("");
    setActive(0);
  }

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">
        {label}
      </label>
      <input
        id={`${listId}-input`}
        type="text"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={results.length ? `${listId}-${highlighted}` : undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        disabled={disabled}
        value={query}
        placeholder={placeholder ?? t("Nom du personnage…", "Character name…")}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((highlighted + 1) % Math.max(1, results.length));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((highlighted - 1 + results.length) % Math.max(1, results.length));
          } else if (event.key === "Enter" && results[highlighted]) {
            event.preventDefault();
            choose(results[highlighted]);
          } else if (event.key === "Escape") {
            setQuery("");
          }
        }}
        className="w-full rounded-lg border-2 border-sea-600 bg-sea-900 px-4 py-3 text-foam placeholder:text-mist/70 focus:border-straw focus:outline-none disabled:opacity-50"
      />
      {results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-sea-600 bg-sea-800 shadow-xl"
        >
          {results.map((character, index) => (
            <li
              key={character.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlighted}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(character)}
              onMouseEnter={() => setActive(index)}
              className={`cursor-pointer px-4 py-2 ${index === highlighted ? "bg-sea-600" : ""}`}
            >
              <span className="font-semibold text-foam">{character.name}</span>
              {character.altName && <span className="ml-2 text-sm text-mist">{character.altName}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
