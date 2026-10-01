import type { Metadata } from "next";
import { ProfileView } from "@/components/ProfileView";

export const metadata: Metadata = {
  title: "Mon profil",
  description: "Ta prime, ton rang, tes amis et ton compte.",
  robots: { index: false },
};

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:py-8">
      <ProfileView />
    </div>
  );
}
