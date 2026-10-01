import type { ReactNode } from "react";
import { ShipHeader } from "@/components/ShipHeader";

/** Équipage, collection, boutique et échanges partagent le même en-tête : ce sont les quatre ponts du navire. */
export default function ShipLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:py-8">
      <ShipHeader />
      {children}
    </div>
  );
}
