import type { Metadata } from "next";
import { ProfileView } from "@/components/ProfileView";

export const metadata: Metadata = {
  title: "Mon profil",
  description: "Ta prime, ton rang et ton équipage.",
  robots: { index: false },
};

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10">
      <h1 className="font-display text-5xl tracking-wide text-foam">Mon profil</h1>
      <ProfileView />
    </div>
  );
}
