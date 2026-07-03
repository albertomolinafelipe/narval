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
import { ConstraintChips } from "./_components/constraint-chips";
import { startupPath } from "@/lib/startup-url";
import {
  type Constraint,
  applyConstraints,
  toggleConstraint,
  locationConstraint,
} from "@/lib/startup/constraints";

type Startup = components["schemas"]["Startup"];

const StartupsMap = dynamic(() => import("./startups-map"), { ssr: false });

interface Props {
  showFavoritedOnly?: boolean;
  initialView?: View;
}

export default function StartupsClient({
  showFavoritedOnly = false,
  initialView = "list",
}: Props) {
  const router = useRouter();
  const requireAuth = useAuthGuard();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [selected, setSelected] = useState<Startup | null>(null);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [showMap, setShowMap] = useState(initialView === "map");
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
    const constrained = applyConstraints(startups, constraints);
    const q = query.trim().toLowerCase();
    if (!q) return constrained;
    return constrained.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.tagline ?? "").toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        (s.industry ?? "").toLowerCase().includes(q) ||
        (s.location ?? "").toLowerCase().includes(q),
    );
  }, [startups, constraints, query]);

  const activeLocations = useMemo(
    () =>
      constraints
        .filter((c) => c.id.startsWith("location:"))
        .map((c) => c.label),
    [constraints],
  );

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
    // No side detail panel (map occupies it, or mobile) → expand the row inline
    // to the detail card instead of navigating to the full profile.
    if (showMap || isMobile) {
      setSelected((prev) => (prev?.id === startup.id ? null : startup));
      return;
    }
    if (selected?.id === startup.id) {
      router.push(startupPath(startup));
    } else {
      setSelected(startup);
    }
  }

  function handleToggleLocation(location: string) {
    setConstraints((cs) => toggleConstraint(cs, locationConstraint(location)));
  }

  function handleRemoveConstraint(id: string) {
    setConstraints((cs) => cs.filter((c) => c.id !== id));
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
      showMap={showMap}
      onShowMapChange={setShowMap}
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

  const chips = (
    <ConstraintChips
      constraints={constraints}
      onRemove={handleRemoveConstraint}
    />
  );

  // When the map occupies the side panel (or on mobile) there's nowhere to show a
  // startup's details, so the selected row expands inline into the detail card.
  const detailInList = showMap || isMobile;

  const inlineDetail = (s: Startup) => (
    <StartupPageClient
      startup={s}
      compact={true}
      hideShare={true}
      onClose={() => setSelected(null)}
    />
  );

  const listEl = (
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
        filtered.map((s) =>
          detailInList && selected?.id === s.id ? (
            <li
              key={s.id}
              className="border-b border-border last:border-b-0"
            >
              {inlineDetail(s)}
            </li>
          ) : (
            <StartupListRow
              key={s.id}
              startup={s}
              expanded={expanded && !isMobile}
              selected={selected?.id === s.id}
              onClick={() => handleStartupClick(s)}
            />
          ),
        )
      )}
    </ul>
  );

  const mapEl = (
    <StartupsMap
      startups={filtered}
      coordsMap={coordsMap}
      activeLocations={activeLocations}
      onToggleLocation={handleToggleLocation}
    />
  );

  // On mobile there's no side panel, so a shortened map sits above the same
  // scrollable list used in list view. Tapping a pin adds a location constraint,
  // narrowing that list.
  if (isMobile && showMap) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {toolbar}
        {chips}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          <div className="h-64 shrink-0 overflow-hidden">{mapEl}</div>
          {listEl}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {toolbar}
      {chips}

      {/* Left: list (always). Right panel: map when toggled on, else detail. */}
      <div className="flex w-full flex-1 gap-4 overflow-hidden">
        <div
          className="flex flex-col transition-[width] duration-300 ease-in-out"
          style={{ width: isMobile ? "100%" : "66.666%" }}
        >
          {listEl}
        </div>

        <div
          className="flex flex-col overflow-hidden transition-[width,opacity] duration-300 ease-in-out"
          style={{ width: isMobile ? "0%" : "33.333%", opacity: isMobile ? 0 : 1 }}
        >
          {showMap ? (
            <div className="h-full w-full overflow-hidden">{mapEl}</div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
