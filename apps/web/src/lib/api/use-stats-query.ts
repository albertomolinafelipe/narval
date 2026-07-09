"use client";

import { useQuery } from "@tanstack/react-query";
import { getStatsOptions } from "./gen/@tanstack/react-query.gen";

/** Query hook for aggregate directory counts (startups + users). */
export function useStatsQuery() {
  return useQuery({
    ...getStatsOptions(),
    staleTime: 5 * 60 * 1000, // counts change slowly — cache for 5 min
  });
}
