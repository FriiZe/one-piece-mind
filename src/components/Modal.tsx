"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * Fenêtre posée par-dessus la page. Elle se ferme avec Échap, la croix ou un
 * clic à côté. À n'afficher que lorsqu'elle est ouverte : elle s'ouvre en
 * apparaissant.
 */
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = useT();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // Le contenu remplit toute la fenêtre : un clic reçu par elle-même est un clic sur le fond
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-sea-600 bg-sea-800 p-0 text-foam backdrop:bg-ink/75 ${
        wide ? "max-w-3xl" : "max-w-xl"
      }`}
    >
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-3xl tracking-wide text-straw">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Fermer", "Close")}
            className="rounded-lg border border-sea-600 px-3 py-1 text-lg font-bold text-mist hover:text-foam"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
