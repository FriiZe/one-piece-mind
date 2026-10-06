import type { Metadata } from "next";
import { PlayerProfileView } from "@/components/PlayerProfileView";
import { getT } from "@/lib/i18n/server";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getT();
  const { username } = await params;
  const name = decodeURIComponent(username);
  return { title: t(`${name}, joueur`, `${name}, player`), robots: { index: false } };
}

/** Page publique d'un joueur : sa prime, son équipage, sa collection, et de quoi l'ajouter en ami. */
export default async function PlayerPage({ params }: Props) {
  const { username } = await params;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:py-8">
      <PlayerProfileView username={decodeURIComponent(username)} />
    </div>
  );
}
