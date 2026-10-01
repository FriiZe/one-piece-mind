import type { Metadata } from "next";
import { ProfileView } from "@/components/ProfileView";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Mon profil", "My profile"),
    description: t("Ta prime, ton rang, tes amis et ton compte.", "Your bounty, your rank, your friends and your account."),
    robots: { index: false },
  };
}

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:py-8">
      <ProfileView />
    </div>
  );
}
