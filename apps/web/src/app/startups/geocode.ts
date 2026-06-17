/**
 * Server-side geocoding utility using the Mapbox Geocoding API.
 * Takes an array of location strings (city names) and returns a map of
 * location -> [longitude, latitude].  Unknown/failed lookups are omitted.
 */

export type CoordsMap = Record<string, [number, number]>;

export async function geocodeLocations(
  locations: string[],
): Promise<CoordsMap> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return {};

  const unique = [...new Set(locations.filter(Boolean))];
  const result: CoordsMap = {};

  await Promise.all(
    unique.map(async (location) => {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          location,
        )}.json?types=place,region,country&limit=1&access_token=${token}`;
        const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
        if (!res.ok) return;
        const data = await res.json();
        const feature = data?.features?.[0];
        if (feature?.center) {
          result[location] = feature.center as [number, number];
        }
      } catch {
        // silently skip failed lookups
      }
    }),
  );

  return result;
}
