"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { localePath } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/client";

/** Lien interne : l'adresse s'écrit sans langue (`/jeux`), le préfixe de la langue en cours est ajouté ici. */
export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  return <NextLink href={typeof href === "string" ? localePath(locale, href) : href} {...props} />;
}
