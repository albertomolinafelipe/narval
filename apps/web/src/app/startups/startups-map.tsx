"use client";

import { useEffect, useRef } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Startup } from "@/lib/api/gen";
import type { CoordsMap } from "@/lib/use-geocode";

export interface LocationGroup {
  location: string;
  coords: [number, number];
  startups: Startup[];
}

interface Props {
  startups: Startup[];
  coordsMap: CoordsMap;
  /** Locations with an active constraint — their pins render highlighted. */
  activeLocations: string[];
  /** Toggle a location constraint when its pin is clicked. */
  onToggleLocation: (location: string) => void;
}

/** Groups startups that share the exact same location string */
function groupByLocation(
  startups: Startup[],
  coordsMap: CoordsMap,
): LocationGroup[] {
  const groups: Record<
    string,
    { coords: [number, number]; startups: Startup[] }
  > = {};

  for (const s of startups) {
    const loc = s.location;
    if (!loc || !coordsMap[loc]) continue;
    if (!groups[loc]) groups[loc] = { coords: coordsMap[loc], startups: [] };
    groups[loc].startups.push(s);
  }

  return Object.entries(groups).map(([location, v]) => ({
    location,
    ...v,
  }));
}

export default function StartupsMap({
  startups,
  coordsMap,
  activeLocations,
  onToggleLocation,
}: Props) {
  const mapRef = useRef<MapRef>(null);

  // Size the GL canvas once the container has settled (e.g. the map panel
  // just appeared or the layout transition finished).
  useEffect(() => {
    const id = setTimeout(() => {
      mapRef.current?.resize();
    }, 310);
    return () => clearTimeout(id);
  }, []);

  const groups = groupByLocation(startups, coordsMap);

  const locatedCount = groups.reduce((n, g) => n + g.startups.length, 0);
  const unlocatedCount = startups.length - locatedCount;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border">
      <Map
        ref={mapRef}
        // Pool and reuse the underlying mapbox instance across mounts instead of
        // destroying it on every list<->map switch. Prevents mapbox's teardown
        // race ("this.errorCb is not a function") when a style/tile request
        // resolves after the map has been unmounted.
        reuseMaps
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: -3.7,
          latitude: 40.4,
          zoom: 5,
          pitch: 0,
          bearing: 0,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        projection="mercator"
        maxPitch={0}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {groups.map((group) => {
          const isActive = activeLocations.includes(group.location);

          return (
            <Marker
              key={group.location}
              longitude={group.coords[0]}
              latitude={group.coords[1]}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onToggleLocation(group.location);
              }}
            >
              <div className="relative cursor-pointer select-none">
                {/* Pin body */}
                <div
                  className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-2 text-xs font-semibold shadow-md transition ${
                    isActive
                      ? "bg-brand-subtle text-brand-text hover:bg-brand-subtle"
                      : "bg-brand text-brand-fg hover:bg-brand-hover"
                  }`}
                >
                  {group.startups.length > 1 ? (
                    group.startups.length
                  ) : (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M8 1.5a4.5 4.5 0 0 1 4.5 4.5c0 3-4.5 8.5-4.5 8.5S3.5 9 3.5 6A4.5 4.5 0 0 1 8 1.5z" />
                    </svg>
                  )}
                </div>
                {/* Pin tail */}
                <div
                  className={`mx-auto h-1.5 w-0.5 ${isActive ? "bg-brand-subtle" : "bg-brand"}`}
                />
              </div>
            </Marker>
          );
        })}
      </Map>

      {unlocatedCount > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text-muted shadow-sm">
          {unlocatedCount} startup{unlocatedCount > 1 ? "s" : ""} without a
          location
        </div>
      )}
    </div>
  );
}
