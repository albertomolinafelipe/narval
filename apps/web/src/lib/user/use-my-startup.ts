"use client";

import { useQuery } from "@tanstack/react-query";
import { getStartupOptions } from "@/lib/api/gen/@tanstack/react-query.gen";
import { useUser } from "./use-user";

/**
 * The authenticated startup account's own profile, fetched by the profile_id
 * on /auth/me. Shares its cache entry with the regular startup detail query.
 * Disabled (data undefined) for non-startup accounts and while unauthenticated.
 */
export function useMyStartup() {
  const { user } = useUser();
  const profileId =
    user?.account_type === "startup" ? (user.profile_id ?? null) : null;

  return useQuery({
    ...getStartupOptions({ path: { id: profileId ?? "" } }),
    enabled: profileId !== null,
  });
}
