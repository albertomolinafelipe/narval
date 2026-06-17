"use client";

import { useQuery } from "@tanstack/react-query";

export type CoordsMap = Record<string, [number, number]>;

/**
 * Client-side geocoding hook using Mapbox Geocoding API.
 * Caches results in React Query for 24 hours.
 */
async function geocodeLocation(
  location: string,
  token: string,
): Promise<[number, number] | null> {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      location,
    )}.json?types=place,region,country&limit=1&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    if (feature?.center) {
      return feature.center as [number, number];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Hook to geocode multiple locations and return a coordsMap.
 * Each location is cached individually in React Query.
 */
export function useGeocode(locations: string[]): {
  coordsMap: CoordsMap;
  isLoading: boolean;
} {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const uniqueLocations = [...new Set(locations.filter(Boolean))];

  // Use a single query that geocodes all locations in parallel
  const { data: coordsMap = {}, isLoading } = useQuery({
    queryKey: ["geocode", uniqueLocations.sort().join(",")],
    queryFn: async () => {
      if (!token || uniqueLocations.length === 0) return {};

      const results = await Promise.all(
        uniqueLocations.map(async (location) => {
          const coords = await geocodeLocation(location, token);
          return { location, coords };
        }),
      );

      const map: CoordsMap = {};
      for (const { location, coords } of results) {
        if (coords) {
          map[location] = coords;
        }
      }
      return map;
    },
    enabled: !!token && uniqueLocations.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
  });

  return { coordsMap, isLoading };
}
