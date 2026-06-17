"use client";

import { useUser } from "@/lib/user";
import { useEffect, useState } from "react";
import ProfileSetupBanner from "./profile-setup-banner";

export default function ProfileSetupChecker() {
  const { user, authenticated } = useUser();
  const [profileData, setProfileData] = useState<{
    profileSetup: boolean;
    profileId: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkProfile() {
      if (!authenticated || !user || user.account_type !== "startup") {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/proxy/startups", {
          credentials: "include",
        });
        if (!res.ok) {
          setLoading(false);
          return;
        }

        const profiles = await res.json();
        const ownProfile = profiles.find(
          (p: { owner_id?: string; id: string; profile_setup?: boolean }) =>
            p.owner_id === user.id,
        );

        if (ownProfile && !ownProfile.profile_setup) {
          setProfileData({ profileSetup: false, profileId: ownProfile.id });
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    checkProfile();
  }, [authenticated, user]);

  if (loading || !profileData) return null;

  return (
    <ProfileSetupBanner
      accountType="startup"
      profileId={profileData.profileId}
    />
  );
}
