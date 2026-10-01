"use client";

import type { GameProps } from "../ui/types";
import { RevealGame } from "./RevealGame";

export default function Revelation(props: GameProps) {
  return <RevealGame {...props} variant="pixel" />;
}
