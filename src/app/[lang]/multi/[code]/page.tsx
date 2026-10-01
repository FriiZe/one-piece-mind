import type { Metadata } from "next";
import { Room } from "@/components/multi/Room";
import { getT } from "@/lib/i18n/server";
import { normalizeCode } from "@/lib/multi/rules";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Salon multijoueur", "Multiplayer room"), robots: { index: false } };
}

export default async function RoomPage({ params }: PageProps<"/[lang]/multi/[code]">) {
  const { code } = await params;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:py-8">
      <Room code={normalizeCode(decodeURIComponent(code))} />
    </div>
  );
}
