"use client";

export default function GameError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
      <h1 className="font-display text-4xl tracking-wide text-foam">Le jeu n&apos;a pas pu se charger</h1>
      <p className="mt-2 text-mist">Vérifie ta connexion, puis réessaie.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-straw px-4 py-2.5 font-bold text-ink hover:bg-straw-dark"
      >
        Réessayer
      </button>
    </div>
  );
}
