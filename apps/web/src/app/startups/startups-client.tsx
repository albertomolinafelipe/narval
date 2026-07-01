"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { components } from "@/lib/api/generated";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { useStartupsQuery } from "@/lib/api/use-startups-query";
import { useGeocode } from "@/lib/use-geocode";
import { useMediaQuery } from "@/lib/use-media-query";
import StartupPageClient from "./startup-page-client";
import { StartupsToolbar, type View, type SortMode } from "./_components/startups-toolbar";
import { StartupListRow } from "./_components/startup-list-row";
import { StartupDetailPlaceholder } from "./_components/startup-detail-placeholder";
import { StartupResultsList } from "./_components/startup-results-list";
import { startupPath } from "@/lib/startup-url";
import type { LocationGroup } from "./startups-map";

type Startup = components["schemas"]["Startup"];

const StartupsMap = dynamic(() => import("./startups-map"), { ssr: false });

interface Props {
  showFavoritedOnly?: boolean;
}

export default function StartupsClient({ showFavoritedOnly = false }: Props) {
  const router = useRouter();
  const requireAuth = useAuthGuard();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [selected, setSelected] = useState<Startup | null>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<LocationGroup | null>(null);
  const [previousContext, setPreviousContext] = useState<
    "all" | "location" | null
  >(null);
  const [view, setView] = useState<View>("list");
  const [sort, setSort] = useState<SortMode>("recent");
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [showFavorites, setShowFavorites] = useState(showFavoritedOnly);
  const [highlight, setHighlight] = useState(false);

  // Use React Query to fetch startups
  const {
    data: startups = [],
    isLoading,
    error,
  } = useStartupsQuery({
    favorited: showFavorites,
    sort,
  });

  // Extract unique locations for geocoding
  const locations = useMemo(
    () => startups.map((s) => s.location).filter(Boolean) as string[],
    [startups],
  );

  // Geocode locations client-side
  const { coordsMap } = useGeocode(locations);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return startups;
    return startups.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.tagline ?? "").toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        (s.industry ?? "").toLowerCase().includes(q) ||
        (s.location ?? "").toLowerCase().includes(q),
    );
  }, [startups, query]);

  // Auto-deselect if the selected item is filtered out.
  const visibleIds = useMemo(
    () => new Set(filtered.map((s) => s.id)),
    [filtered],
  );
  if (selected && !visibleIds.has(selected.id)) {
    setSelected(null);
  }

  // Trigger highlight animation when selected startup changes
  useEffect(() => {
    if (selected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional animation trigger
      setHighlight(true);
      const timer = setTimeout(() => setHighlight(false), 600);
      return () => clearTimeout(timer);
    }
  }, [selected]);

  function handleStartupClick(startup: Startup) {
    if (isMobile) {
      router.push(startupPath(startup));
      return;
    }
    if (selected?.id === startup.id) {
      router.push(startupPath(startup));
    } else {
      setSelected(startup);
    }
  }

  function handleLocationSelect(locationGroup: LocationGroup) {
    // Clear startup selection and show location group
    setSelected(null);
    setSelectedLocation(locationGroup);
    setPreviousContext("all"); // Remember we came from 'all' view
  }

  function handleCloseStartupDetail() {
    setSelected(null);
    // If we have a previous context (we're in map view), restore it
    if (view === "map") {
      if (previousContext === "all" || !selectedLocation) {
        // Show all startups list
        setSelectedLocation(null);
        setPreviousContext(null);
      }
      // If previousContext === 'location', keep selectedLocation as is
    }
  }

  function handleCloseLocationList() {
    setSelectedLocation(null);
    setPreviousContext(null);
  }

  function handleFavoritedToggle() {
    // If trying to view favorited startups, require auth
    if (!showFavorites && !requireAuth()) {
      return;
    }

    setShowFavorites(!showFavorites);
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">
        Failed to load startups. Please try again.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (startups.length === 0 && !showFavorites) {
    return <p className="text-sm text-text-muted">No startups yet.</p>;
  }

  const toolbar = (
    <StartupsToolbar
      view={view}
      onViewChange={setView}
      showFavorites={showFavorites}
      onFavoritesToggle={handleFavoritedToggle}
      sort={sort}
      onSortChange={setSort}
      expanded={expanded}
      onExpandedChange={setExpanded}
      query={query}
      onQueryChange={setQuery}
    />
  );

  const allStartupsSubtitle = `${filtered.length} startup${filtered.length !== 1 ? "s" : ""}`;
  const locationSubtitle = selectedLocation
    ? `${selectedLocation.startups.length} startup${selectedLocation.startups.length !== 1 ? "s" : ""} at this location`
    : "";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {view === "list" ? (
        <>
          {toolbar}

          {/* Content: list + panel */}
          <div className="flex w-full flex-1 gap-4 overflow-hidden">
            {/* Left: list */}
            <div
              className="flex flex-col transition-[width,margin] duration-300 ease-in-out"
              style={
                isMobile
                  ? { width: "100%", marginLeft: "0" }
                  : { width: "66.666%", marginLeft: "0%" }
              }
            >
              {/* List */}
              <ul
                role="list"
                className="flex flex-col overflow-y-auto rounded-xl border border-border max-md:flex-1 max-md:min-h-0"
              >

                {filtered.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-text-muted">
                    {showFavorites && startups.length === 0
                      ? "No favorited startups yet."
                      : `No results for "${query}"`}
                  </li>
                ) : (
                  filtered.map((s) => (
                    <StartupListRow
                      key={s.id}
                      startup={s}
                      expanded={expanded}
                      selected={selected?.id === s.id}
                      onClick={() => handleStartupClick(s)}
                    />
                  ))
                )}
              </ul>
            </div>

            {/* Right: detail panel — always present on desktop, hidden on mobile */}
            <div
              className="flex flex-col overflow-hidden transition-[width,opacity] duration-300 ease-in-out"
              style={{
                width: isMobile ? "0%" : "33.333%",
                opacity: isMobile ? 0 : 1,
              }}
            >
              <div
                className={`flex h-full flex-col overflow-y-auto rounded-xl border bg-bg transition-all duration-300 ${
                  highlight
                    ? "border-brand shadow-lg shadow-brand/20"
                    : "border-border"
                }`}
              >
                {selected ? (
                  <StartupPageClient
                    key={selected.id}
                    startup={selected}
                    compact={true}
                    onClose={() => setSelected(null)}
                  />
                ) : (
                  <StartupDetailPlaceholder />
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {toolbar}

          {/* Map view */}
          <div className={`flex flex-1 overflow-hidden ${isMobile ? "flex-col" : "w-full gap-4"}`}>
            {/* Map */}
            <div className="flex-1 overflow-hidden">
              <div className="relative h-full w-full">
                <StartupsMap
                  startups={filtered}
                  coordsMap={coordsMap}
                  selected={selected}
                  onSelect={(s) => {
                    handleStartupClick(s);
                    if (!isMobile) {
                      if (selectedLocation) setPreviousContext("location");
                      else setPreviousContext("all");
                    }
                  }}
                  onLocationSelect={(group) => {
                    handleLocationSelect(group);
                  }}
                />
              </div>
            </div>

            {/* Mobile: scrollable list below map | Desktop: detail panel */}
            {isMobile ? (
              <div className="flex-1 min-h-0 overflow-hidden border-t border-border">
                {selectedLocation ? (
                  <StartupResultsList
                    startups={selectedLocation.startups}
                    title={selectedLocation.location}
                    subtitle={locationSubtitle}
                    onStartupClick={handleStartupClick}
                    onClose={handleCloseLocationList}
                  />
                ) : (
                  <StartupResultsList
                    startups={filtered}
                    title="All Startups"
                    subtitle={allStartupsSubtitle}
                    onStartupClick={handleStartupClick}
                    showLocation
                  />
                )}
              </div>
            ) : (
              <div
                className="flex flex-col overflow-hidden transition-[width,opacity] duration-300 ease-in-out"
                style={{ width: "33.333%", opacity: 1 }}
              >
                <div
                  className={`flex h-full flex-col overflow-y-auto rounded-xl border bg-bg transition-all duration-300 ${
                    highlight
                      ? "border-brand shadow-lg shadow-brand/20"
                      : "border-border"
                  }`}
                >
                  {selected ? (
                    <StartupPageClient
                      key={selected.id}
                      startup={selected}
                      compact={true}
                      onClose={handleCloseStartupDetail}
                    />
                  ) : selectedLocation ? (
                    <StartupResultsList
                      startups={selectedLocation.startups}
                      title={selectedLocation.location}
                      subtitle={locationSubtitle}
                      onStartupClick={(s) => {
                        handleStartupClick(s);
                        setPreviousContext("location");
                      }}
                      onClose={handleCloseLocationList}
                    />
                  ) : (
                    <StartupResultsList
                      startups={filtered}
                      title="All Startups"
                      subtitle={allStartupsSubtitle}
                      onStartupClick={(s) => {
                        handleStartupClick(s);
                        setPreviousContext("all");
                      }}
                      showLocation
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
