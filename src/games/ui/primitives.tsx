"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { useRoomRound } from "./roomRound";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-straw text-ink hover:bg-straw-dark",
  secondary: "border border-sea-600 bg-sea-700 text-foam hover:bg-sea-600",
  ghost: "text-mist underline-offset-4 hover:text-foam hover:underline",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-lg px-4 py-2.5 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  );
}

/**
 * Correction d'une manche et bouton pour passer à la suite. Sur téléphone, le
 * bouton occupe toute la largeur, au-dessus du texte : il reste au même endroit,
 * que la correction tienne sur une ligne ou sur trois. Sur grand écran, il se
 * tient à droite du texte.
 */
export function Correction({ children, action, live = true }: { children: ReactNode; action: ReactNode; live?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-live={live ? "polite" : undefined}>
      <div className="min-w-0 sm:flex-1">{children}</div>
      <div className="order-first grid sm:order-none sm:block sm:shrink-0">{action}</div>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-sea-700 bg-sea-800/70 p-4 sm:p-6 ${className}`}>{children}</div>;
}

/** Copie un texte dans le presse-papiers (résultat à partager). */
export function ShareButton({ getText, label }: { getText: () => string; label?: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function share() {
    try {
      await navigator.clipboard.writeText(getText());
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2500);
  }

  return (
    <Button variant="secondary" onClick={share}>
      <span aria-live="polite">
        {state === "copied"
          ? t("Copié !", "Copied!")
          : state === "failed"
            ? t("Copie impossible", "Couldn't copy")
            : (label ?? t("Partager mon résultat", "Share my result"))}
      </span>
    </Button>
  );
}

export function ResultPanel({
  title,
  children,
  best,
  newBest,
  actions,
}: {
  title: string;
  children?: ReactNode;
  best?: { label: string; value: string } | null;
  newBest?: boolean;
  actions: ReactNode;
}) {
  const t = useT();
  // En salon, la partie compte pour une manche : ni record, ni « Rejouer » (le salon dit qui reste à attendre)
  const inRoom = useRoomRound() !== null;
  return (
    <div role="status" className="rounded-2xl bg-parchment p-5 text-ink sm:p-6">
      <h3 className="font-display text-3xl tracking-wide">{title}</h3>
      {children && <div className="mt-2 space-y-1">{children}</div>}
      {inRoom && (
        <p className="mt-4 font-semibold">{t("Manche terminée.", "Round over.")}</p>
      )}
      {!inRoom && best && (
        <p className="mt-2 text-sm font-semibold">
          {newBest ? t("Nouveau record ! ", "New best! ") : ""}
          {best.label}
          {t(" : ", ": ")}
          {best.value}
        </p>
      )}
      {!inRoom && <div className="mt-4 flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function Progress({ current, total, score }: { current: number; total: number; score?: string }) {
  return (
    <div className="flex items-center justify-between text-sm font-semibold text-mist">
      <span>
        {current} / {total}
      </span>
      {score && <span>{score}</span>}
    </div>
  );
}
