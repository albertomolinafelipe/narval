"use client";

import { useMyStartup } from "@/lib/user";
import ProfileSetupBanner from "./profile-setup-banner";

export default function ProfileSetupChecker() {
  const { data: startup } = useMyStartup();

  if (!startup || startup.profile_setup) return null;

  return <ProfileSetupBanner accountType="startup" profileId={startup.id} />;
}
