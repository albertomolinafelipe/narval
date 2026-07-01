"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "./client";

export const statsKeys = {
  all: ["stats"] as const,
};

/** Query hook for aggregate directory counts (startups + users). */
export function useStatsQuery() {
  return useQuery({
    queryKey: statsKeys.all,
    queryFn: fetchStats,
    staleTime: 5 * 60 * 1000, // counts change slowly — cache for 5 min
  });
}
