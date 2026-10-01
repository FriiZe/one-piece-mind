"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Portrait } from "./Portrait";

export type SortableItem = {
  id: string;
  label: string;
  /** Précision affichée une fois le classement validé (la prime, la date…). */
  detail?: string;
  /** Portrait (fichier dans /images/portraits), s'il y en a un. */
  img?: string | null;
};

const swap = (order: readonly string[], a: number, b: number) => {
  const next = [...order];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
};

/**
 * Liste à ranger : chaque ligne se fait glisser à sa place, à la souris comme
 * au doigt (par la poignée), et garde ses flèches pour le clavier. Une fois le
 * classement validé, chaque ligne dit si elle est au bon rang.
 */
export function SortableList({
  order,
  items,
  expected,
  submitted,
  onReorder,
}: {
  order: readonly string[];
  items: ReadonlyMap<string, SortableItem>;
  /** Le bon ordre, pour la correction. */
  expected: readonly string[];
  submitted: boolean;
  onReorder: (order: string[]) => void;
}) {
  const t = useT();
  /** Ligne en cours de déplacement, et de combien elle suit le pointeur. */
  const [drag, setDrag] = useState<{ id: string; offset: number } | null>(null);
  const nodes = useRef(new Map<string, HTMLLIElement>());
  // Ce dont le suivi du pointeur a besoin, à jour sans relancer l'écoute à chaque rendu
  const live = useRef({ order, onReorder, origin: 0, offset: 0, waiting: false });

  useEffect(() => {
    live.current.order = order;
    live.current.onReorder = onReorder;
    // L'échange demandé est affiché : on peut de nouveau comparer les positions
    live.current.waiting = false;
  }, [order, onReorder]);

  const dragId = drag?.id ?? null;
  useEffect(() => {
    if (dragId === null) return;

    const move = (event: PointerEvent) => {
      const state = live.current;
      const node = nodes.current.get(dragId);
      if (!node || state.waiting) return;
      const index = state.order.indexOf(dragId);
      let offset = event.clientY - state.origin;

      const rect = node.getBoundingClientRect();
      // Position de la ligne sans son déplacement en cours
      const top = rect.top - state.offset;
      const center = top + offset + rect.height / 2;

      // Nouveau rang : le nombre de lignes dont le milieu est au-dessus de celui de la ligne déplacée.
      // Un geste rapide peut en franchir plusieurs d'un coup.
      const others = state.order.filter((id) => id !== dragId).map((id) => nodes.current.get(id)?.getBoundingClientRect());
      const target = others.filter((other) => other && other.top + other.height / 2 < center).length;
      if (target !== index) {
        const displaced = nodes.current.get(state.order[target])!.getBoundingClientRect();
        // Là où la ligne se posera : à la place de celle qu'elle déloge, en haut ou en bas selon le sens
        const landing = target < index ? displaced.top : displaced.bottom - rect.height;
        const shift = top - landing;
        state.origin -= shift;
        offset += shift;
        state.waiting = true;
        const next = state.order.filter((id) => id !== dragId);
        next.splice(target, 0, dragId);
        state.onReorder(next);
      }
      state.offset = offset;
      setDrag({ id: dragId, offset });
    };
    const end = () => {
      live.current.offset = 0;
      setDrag(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragId]);

  function begin(event: React.PointerEvent<HTMLLIElement>, id: string) {
    if (submitted || event.button !== 0) return;
    const target = event.target as HTMLElement;
    // Les flèches restent des boutons ; au doigt, seule la poignée déplace (le reste de la ligne fait défiler la page)
    if (target.closest("button")) return;
    if (event.pointerType !== "mouse" && !target.closest("[data-handle]")) return;
    event.preventDefault();
    live.current.origin = event.clientY;
    live.current.offset = 0;
    setDrag({ id, offset: 0 });
  }

  return (
    <ol className="space-y-2">
      {order.map((id, index) => {
        const item = items.get(id)!;
        const right = submitted && expected[index] === id;
        const dragging = drag?.id === id;
        return (
          <li
            key={id}
            ref={(node) => {
              if (node) nodes.current.set(id, node);
              else nodes.current.delete(id);
            }}
            onPointerDown={(event) => begin(event, id)}
            style={dragging ? { transform: `translateY(${drag.offset}px)` } : undefined}
            className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 select-none ${
              submitted
                ? right
                  ? "border-emerald-400 bg-emerald-600/20"
                  : "border-vest bg-vest/20"
                : dragging
                  ? "relative z-10 cursor-grabbing border-straw bg-sea-600 shadow-2xl"
                  : "cursor-grab border-sea-600 bg-sea-700 hover:border-mist"
            }`}
          >
            {!submitted && (
              <span data-handle aria-hidden="true" className="-mx-1 touch-none px-1 text-xl leading-none text-mist">
                ⠿
              </span>
            )}
            <span className="w-6 text-center font-display text-2xl text-straw">{index + 1}</span>
            {item.img && <Portrait img={item.img} className="h-12 w-10 shrink-0" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-foam">{item.label}</span>
              {submitted && (
                <span className="block text-sm text-mist">
                  {item.detail}
                  {!right && t(` · rang attendu : ${expected.indexOf(id) + 1}`, ` · expected rank: ${expected.indexOf(id) + 1}`)}
                </span>
              )}
            </span>
            {!submitted && (
              <span className="flex gap-1">
                <button
                  type="button"
                  aria-label={t(`Monter ${item.label}`, `Move ${item.label} up`)}
                  disabled={index === 0}
                  onClick={() => onReorder(swap(order, index, index - 1))}
                  className="h-10 w-10 rounded-lg bg-sea-600 text-lg text-foam hover:bg-straw hover:text-ink disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={t(`Descendre ${item.label}`, `Move ${item.label} down`)}
                  disabled={index === order.length - 1}
                  onClick={() => onReorder(swap(order, index, index + 1))}
                  className="h-10 w-10 rounded-lg bg-sea-600 text-lg text-foam hover:bg-straw hover:text-ink disabled:opacity-30"
                >
                  ▼
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
