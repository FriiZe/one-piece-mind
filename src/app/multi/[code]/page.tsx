import type { Metadata } from "next";
import { Room } from "@/components/multi/Room";
import { normalizeCode } from "@/lib/multi/rules";

export const metadata: Metadata = {
  title: "Salon multijoueur",
  robots: { index: false },
};

export default async function RoomPage({ params }: PageProps<"/multi/[code]">) {
  const { code } = await params;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:py-8">
      <Room code={normalizeCode(decodeURIComponent(code))} />
    </div>
  );
}
