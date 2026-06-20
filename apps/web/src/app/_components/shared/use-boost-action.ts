"use client";

import { useState } from "react";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { useBoostMutation } from "@/lib/api/use-startups-query";
import { components } from "@/lib/api/generated";

type Startup = components["schemas"]["Startup"];

/**
 * Shared boost behavior for the boost button / counter: auth guard, mutation,
 * pending state, and the 2s "boost-animate" trigger. Reads boosted/count from
 * the passed startup (kept fresh by the query cache via optimistic updates).
 */
export function useBoostAction(
  startup: Pick<Startup, "id" | "has_boosted" | "boost_count">,
) {
  const requireAuth = useAuthGuard();
  const boostMutation = useBoostMutation();
  const [isAnimating, setIsAnimating] = useState(false);

  const boosted = startup.has_boosted ?? false;
  const count = startup.boost_count ?? 0;

  async function boost() {
    if (boosted || boostMutation.isPending) return;
    if (!requireAuth()) return;

    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 2000); // Match CSS duration

    try {
      await boostMutation.mutateAsync(startup.id);
    } catch (error) {
      console.error("Failed to boost:", error);
    }
  }

  return {
    boosted,
    count,
    isPending: boostMutation.isPending,
    isAnimating,
    boost,
  };
}
