"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { components } from "@/lib/api/generated";
import { useUser } from "@/lib/user";
import ProfileClient from "./profile-client";

type Startup = components["schemas"]["Startup"];

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [startup, setStartup] = useState<Startup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      if (userLoading) return;

      if (!user) {
        router.push("/");
        return;
      }

      if (user.account_type !== "startup") {
        router.push("/startups");
        return;
      }

      if (!user.profile_id) {
        router.push("/startups");
        return;
      }

      try {
        const res = await fetch(`/api/proxy/startups/${user.profile_id}`, {
          credentials: "include",
        });

        if (!res.ok) {
          router.push("/startups");
          return;
        }

        setStartup(await res.json());
      } catch {
        router.push("/");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user, userLoading, router]);

  if (userLoading || loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!startup) return null;

  return <ProfileClient startup={startup} />;
}
