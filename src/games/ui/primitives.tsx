"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";

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

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-sea-700 bg-sea-800/70 p-4 sm:p-6 ${className}`}>{children}</div>;
}

/** Copie un texte dans le presse-papiers (résultat à partager). */
export function ShareButton({ getText }: { getText: () => string }) {
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
        {state === "copied" ? "Copié !" : state === "failed" ? "Copie impossible" : "Partager mon résultat"}
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
  return (
    <div role="status" className="rounded-2xl bg-parchment p-5 text-ink sm:p-6">
      <h3 className="font-display text-3xl tracking-wide">{title}</h3>
      {children && <div className="mt-2 space-y-1">{children}</div>}
      {best && (
        <p className="mt-2 text-sm font-semibold">
          {newBest ? "Nouveau record ! " : ""}
          {best.label} : {best.value}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">{actions}</div>
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
