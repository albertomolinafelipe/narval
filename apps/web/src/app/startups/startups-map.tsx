"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { components } from "@/lib/api/generated";
import type { CoordsMap } from "@/lib/use-geocode";

type Startup = components["schemas"]["Startup"];

export interface LocationGroup {
  location: string;
  coords: [number, number];
  startups: Startup[];
}

interface Props {
  startups: Startup[];
  coordsMap: CoordsMap;
  selected: Startup | null;
  onSelect: (startup: Startup) => void;
  onLocationSelect: (group: LocationGroup) => void;
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
  selected,
  onSelect,
  onLocationSelect,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const [clickedLocation, setClickedLocation] = useState<string | null>(null);

  // Resize the GL canvas whenever the detail panel opens or closes
  useEffect(() => {
    const id = setTimeout(() => {
      mapRef.current?.resize();
    }, 310); // just after the 300ms CSS transition completes
    return () => clearTimeout(id);
  }, [selected]);

  const handleMarkerClick = useCallback(
    (group: LocationGroup) => {
      // Set this pin as clicked
      setClickedLocation(group.location);

      // If there's only one startup at this location, select it directly
      if (group.startups.length === 1) {
        onSelect(group.startups[0]);
      } else {
        // Otherwise, show the location group in the panel
        onLocationSelect(group);
      }
    },
    [onSelect, onLocationSelect],
  );

  const groups = groupByLocation(startups, coordsMap);

  const locatedCount = groups.reduce((n, g) => n + g.startups.length, 0);
  const unlocatedCount = startups.length - locatedCount;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border">
      <Map
        ref={mapRef}
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
        onClick={() => setClickedLocation(null)}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {groups.map((group) => {
          const isClicked = clickedLocation === group.location;

          return (
            <Marker
              key={group.location}
              longitude={group.coords[0]}
              latitude={group.coords[1]}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleMarkerClick(group);
              }}
            >
              <div className="relative cursor-pointer select-none">
                {/* Pin body */}
                <div
                  className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-2 text-xs font-semibold shadow-md transition ${
                    isClicked
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
                  className={`mx-auto h-1.5 w-0.5 ${isClicked ? "bg-brand-subtle" : "bg-brand"}`}
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
