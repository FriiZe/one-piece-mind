"use client";

import { useT } from "@/lib/i18n/client";

export default function GameError({ reset }: { error: Error; reset: () => void }) {
  const t = useT();
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
      <h1 className="font-display text-4xl tracking-wide text-foam">{t("Le jeu n'a pas pu se charger", "The game couldn't load")}</h1>
      <p className="mt-2 text-mist">{t("Vérifie ta connexion, puis réessaie.", "Check your connection, then try again.")}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-straw px-4 py-2.5 font-bold text-ink hover:bg-straw-dark"
      >
        {t("Réessayer", "Try again")}
      </button>
    </div>
  );
}
