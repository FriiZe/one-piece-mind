"use client";

import { RevealGame } from "../revelation/RevealGame";
import type { GameProps } from "../ui/types";

export default function ZoomExtreme(props: GameProps) {
  return <RevealGame {...props} variant="zoom" />;
}
