"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { List, Map, Star, Search, Loader2 } from "lucide-react";
import { components } from "@/lib/api/generated";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { useStartupsQuery } from "@/lib/api/use-startups-query";
import { useGeocode } from "@/lib/use-geocode";
import { Avatar } from "@/app/_components/shared/list-panel";
import { BoostCounter } from "@/app/_components/shared/boost-counter";
import StartupPageClient from "./[id]/startup-page-client";
import type { LocationGroup } from "./startups-map";

type Startup = components["schemas"]["Startup"];

const StartupsMap = dynamic(() => import("./startups-map"), { ssr: false });

interface Props {
  showFavoritedOnly?: boolean;
}

type View = "list" | "map";

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
      router.push(`/startups/${startup.id}`);
      return;
    }
    if (selected?.id === startup.id) {
      router.push(`/startups/${startup.id}`);
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

  const toggle = (
    <div className="inline-flex rounded-lg border border-border bg-bg-raised p-0.5 shadow-sm">
      <button
        type="button"
        onClick={() => setView("list")}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
          view === "list"
            ? "bg-bg-subtle text-text shadow-sm"
            : "text-text-muted hover:text-text"
        }`}
      >
        <List size={13} />
        List
      </button>
      <button
        type="button"
        onClick={() => setView("map")}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
          view === "map"
            ? "bg-bg-subtle text-text shadow-sm"
            : "text-text-muted hover:text-text"
        }`}
      >
        <Map size={13} />
        Map
      </button>
    </div>
  );

  const favoritesToggle = (
    <div className="inline-flex rounded-lg border border-border bg-bg-raised p-0.5 shadow-sm">
      <button
        type="button"
        onClick={handleFavoritedToggle}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
          showFavorites
            ? "bg-bg-subtle text-text shadow-sm"
            : "text-text-muted hover:text-text"
        }`}
      >
        <Star size={13} fill={showFavorites ? "currentColor" : "none"} />
        Favorites
      </button>
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {view === "list" ? (
        <>
          {/* Toolbar - fixed on left */}
          <div className="flex items-center gap-2 pb-3">
            {toggle}
            {favoritesToggle}
            <div className="relative w-56">
              <Search
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter startups…"
                className="h-8 w-full rounded-lg border border-border bg-bg-raised pl-8 pr-3 text-xs text-text placeholder:text-text-subtle outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
              />
            </div>
          </div>

          {/* Content: list + panel */}
          <div className="flex w-full flex-1 gap-4 overflow-hidden">
            {/* Left: list */}
            <div
              className="flex flex-col transition-[width,margin] duration-300 ease-in-out"
              style={
                isMobile
                  ? { width: "100%", marginLeft: "0" }
                  : {
                      width: selected ? "66.666%" : "50%",
                      marginLeft: selected ? "0%" : "25%",
                    }
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
                    <li
                      key={s.id}
                      className={`border-b border-border last:border-b-0 ${
                        s.has_boosted
                          ? "border-l-4 border-l-brand bg-brand-subtle/10"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleStartupClick(s)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-bg-subtle ${
                          selected?.id === s.id ? "bg-bg-subtle" : ""
                        }`}
                      >
                        {/* Boost counter on the left (non-clickable) */}
                        <div className="shrink-0">
                          <BoostCounter
                            count={s.boost_count ?? 0}
                            boosted={s.has_boosted ?? false}
                            clickable={false}
                          />
                        </div>

                        {/* Avatar and content */}
                        <Avatar entity={s} size={12} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text">
                            {s.name}
                          </p>
                          <p className="truncate text-xs text-text-muted">
                            {s.owner_email}
                          </p>
                          {(s.tagline || s.description) && (
                            <p className="mt-1 line-clamp-2 text-xs text-text-subtle">
                              {s.tagline ?? s.description}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Right: detail panel — hidden on mobile */}
            <div
              className="flex flex-col overflow-hidden transition-[width,opacity] duration-300 ease-in-out"
              style={{
                width: isMobile ? "0%" : selected ? "33.333%" : "0%",
                opacity: isMobile ? 0 : selected ? 1 : 0,
              }}
            >
              <div
                className={`flex h-full flex-col overflow-y-auto rounded-xl border bg-bg transition-all duration-300 ${
                  highlight
                    ? "border-brand shadow-lg shadow-brand/20"
                    : "border-border"
                }`}
              >
                {selected && (
                  <StartupPageClient
                    key={selected.id}
                    startup={selected}
                    compact={true}
                    onClose={() => setSelected(null)}
                  />
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Toolbar - static above map */}
          <div className="flex items-center gap-2 pb-3">
            {toggle}
            {favoritesToggle}
            <div className="relative w-56">
              <Search
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter startups…"
                className="h-8 w-full rounded-lg border border-border bg-bg-raised pl-8 pr-3 text-xs text-text placeholder:text-text-subtle outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
              />
            </div>
          </div>

          {/* Map view with detail panel */}
          <div className="flex w-full flex-1 gap-4 overflow-hidden">
            {/* Left: map takes available space */}
            <div className="flex-1 overflow-hidden">
              <div className="relative h-full w-full">
                <StartupsMap
                  startups={filtered}
                  coordsMap={coordsMap}
                  selected={selected}
                  onSelect={(s) => {
                    handleStartupClick(s);
                    // Set context based on current view
                    if (selectedLocation) {
                      setPreviousContext("location");
                    } else {
                      setPreviousContext("all");
                    }
                  }}
                  onLocationSelect={handleLocationSelect}
                />
              </div>
            </div>

            {/* Right: detail panel - always visible in map view */}
            <div
              className="flex flex-col overflow-hidden transition-[width,opacity] duration-300 ease-in-out"
              style={{
                width: "33.333%",
                opacity: 1,
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
                    onClose={handleCloseStartupDetail}
                  />
                ) : selectedLocation ? (
                  <LocationStartupsList
                    locationGroup={selectedLocation}
                    onStartupClick={(s) => {
                      handleStartupClick(s);
                      setPreviousContext("location");
                    }}
                    onClose={handleCloseLocationList}
                  />
                ) : (
                  <AllStartupsList
                    startups={filtered}
                    onStartupClick={(s) => {
                      handleStartupClick(s);
                      setPreviousContext("all");
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── All Startups List Component ──────────────────────────────────────────────

function AllStartupsList({
  startups,
  onStartupClick,
}: {
  startups: Startup[];
  onStartupClick: (startup: Startup) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <h2 className="text-lg font-semibold text-text">All Startups</h2>
        <p className="mt-0.5 text-sm text-text-muted">
          {startups.length} startup{startups.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Body - scrollable list of startups */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {startups.length === 0 ? (
          <p className="text-center text-sm text-text-muted py-8">
            No startups found
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {startups.map((startup) => (
              <li key={startup.id}>
                <button
                  type="button"
                  onClick={() => onStartupClick(startup)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-bg p-3 text-left transition hover:border-brand hover:bg-bg-subtle"
                >
                  {/* Boost counter */}
                  <div className="shrink-0">
                    <BoostCounter
                      count={startup.boost_count ?? 0}
                      boosted={startup.has_boosted ?? false}
                      clickable={false}
                    />
                  </div>

                  {/* Avatar and content */}
                  <Avatar entity={startup} size={12} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">
                      {startup.name}
                    </p>
                    {(startup.tagline || startup.description) && (
                      <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                        {startup.tagline ?? startup.description}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1 text-xs text-text-subtle">
                      {startup.industry && <span>{startup.industry}</span>}
                      {startup.location && startup.industry && <span>•</span>}
                      {startup.location && <span>{startup.location}</span>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Location Startups List Component ─────────────────────────────────────────

function LocationStartupsList({
  locationGroup,
  onStartupClick,
  onClose,
}: {
  locationGroup: LocationGroup;
  onStartupClick: (startup: Startup) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-text">
            {locationGroup.location}
          </h2>
          <p className="mt-0.5 text-sm text-text-muted">
            {locationGroup.startups.length} startup
            {locationGroup.startups.length !== 1 ? "s" : ""} at this location
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-text-muted transition hover:bg-bg-subtle hover:text-text"
          aria-label="Back to all startups"
          title="Back to all startups"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M2 2l12 12M14 2L2 14" />
          </svg>
        </button>
      </div>

      {/* Body - scrollable list of startups */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <ul className="flex flex-col gap-2">
          {locationGroup.startups.map((startup) => (
            <li key={startup.id}>
              <button
                type="button"
                onClick={() => onStartupClick(startup)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-bg p-3 text-left transition hover:border-brand hover:bg-bg-subtle"
              >
                {/* Boost counter */}
                <div className="shrink-0">
                  <BoostCounter
                    count={startup.boost_count ?? 0}
                    boosted={startup.has_boosted ?? false}
                    clickable={false}
                  />
                </div>

                {/* Avatar and content */}
                <Avatar entity={startup} size={12} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {startup.name}
                  </p>
                  {(startup.tagline || startup.description) && (
                    <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                      {startup.tagline ?? startup.description}
                    </p>
                  )}
                  {startup.industry && (
                    <p className="mt-1 text-xs text-text-subtle">
                      {startup.industry}
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}
