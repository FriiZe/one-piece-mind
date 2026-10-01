import { notFound } from "next/navigation";

/** Toute adresse qui ne correspond à aucune page : la 404 du site, dans la langue de l'adresse. */
export default function UnknownPage() {
  notFound();
}
