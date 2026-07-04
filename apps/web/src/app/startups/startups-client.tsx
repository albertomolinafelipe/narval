"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { components } from "@/lib/api/generated";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { useStartupsQuery } from "@/lib/api/use-startups-query";
import { useGeocode } from "@/lib/use-geocode";
import { useMediaQuery } from "@/lib/use-media-query";
import StartupPageClient from "./startup-page-client";
import {
  StartupsToolbar,
  type View,
  type SortMode,
} from "./_components/startups-toolbar";
import { StartupListRow } from "./_components/startup-list-row";
import { StartupDetailPlaceholder } from "./_components/startup-detail-placeholder";
import { ConstraintChips } from "./_components/constraint-chips";
import {
  type Constraint,
  applyConstraints,
  toggleConstraint,
  locationConstraint,
} from "@/lib/startup/constraints";

type Startup = components["schemas"]["Startup"];

const StartupsMap = dynamic(() => import("./startups-map"), { ssr: false });

// Persisted list state so leaving for a profile and coming back restores the
// selected startup and scroll position.
const LIST_STATE_KEY = "startups:list-state";

interface Props {
  showFavoritedOnly?: boolean;
  initialView?: View;
}

export default function StartupsClient({
  showFavoritedOnly = false,
  initialView = "list",
}: Props) {
  const requireAuth = useAuthGuard();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [selected, setSelected] = useState<Startup | null>(null);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [showMap, setShowMap] = useState(initialView === "map");
  const [sort, setSort] = useState<SortMode>("recent");
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [showFavorites, setShowFavorites] = useState(showFavoritedOnly);
  // Id of the row playing its collapse animation before it unmounts.
  const [closingId, setClosingId] = useState<Startup["id"] | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll/selection restore across a trip to a startup profile.
  const listRef = useRef<HTMLUListElement>(null);
  const scrollTopRef = useRef(0);
  const selectedIdRef = useRef<Startup["id"] | null>(null);
  // Id restored from storage: its row renders already-open (no drop-in
  // animation). Cleared as soon as the user interacts.
  const [restoreOpenId, setRestoreOpenId] = useState<Startup["id"] | null>(
    null,
  );
  const restoredRef = useRef(false);

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

  // Keep a row rendered while it plays its `drop-close` animation, then drop it.
  // Keep CLOSE_MS in sync with the `drop-close` duration in globals.css.
  const CLOSE_MS = 240;
  function startClosing(id: Startup["id"]) {
    setClosingId(id);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setClosingId((cur) => (cur === id ? null : cur));
      closeTimer.current = null;
    }, CLOSE_MS);
  }

  // Collapse the open card: animate it out, and deselect immediately so nothing
  // else treats it as selected while it plays out.
  function collapse() {
    if (!selected) return;
    setRestoreOpenId(null);
    startClosing(selected.id);
    setSelected(null);
  }

  // Clear any pending collapse timer on unmount.
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  // Track the latest selected id for the unmount save below.
  useEffect(() => {
    selectedIdRef.current = selected?.id ?? null;
  }, [selected]);

  // Save selection + scroll on unmount so we can restore them on return.
  useEffect(
    () => () => {
      try {
        sessionStorage.setItem(
          LIST_STATE_KEY,
          JSON.stringify({
            selectedId: selectedIdRef.current,
            scrollTop: scrollTopRef.current,
          }),
        );
      } catch {
        // sessionStorage may be unavailable (private mode / SSR) — ignore.
      }
    },
    [],
  );

  // Restore selection + scroll once the list data is available. Runs once.
  useEffect(() => {
    if (restoredRef.current || startups.length === 0) return;
    restoredRef.current = true;

    let saved: { selectedId: Startup["id"] | null; scrollTop: number } | null =
      null;
    try {
      const raw = sessionStorage.getItem(LIST_STATE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      // ignore
    }
    if (!saved) return;

    if (saved.selectedId != null) {
      const match = startups.find((s) => s.id === saved.selectedId);
      if (match) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from sessionStorage
        setRestoreOpenId(match.id);
        setSelected(match);
      }
    }

    // Wait for the (possibly newly-selected, already-open) row to render, then
    // set the scroll position.
    const target = saved.scrollTop ?? 0;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = target;
      }),
    );
  }, [startups]);

  function handleStartupClick(startup: Startup) {
    // Any manual interaction ends the "restored" state, so rows animate again.
    setRestoreOpenId(null);
    // Selecting a startup expands its row inline into the detail card ("tall
    // row"); clicking it again collapses it with an animation.
    if (selected?.id === startup.id) {
      collapse();
      return;
    }
    // Switching: animate the previously open row out while the new one opens.
    if (selected) startClosing(selected.id);
    setSelected(startup);
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

  const inlineDetail = (s: Startup) => (
    <StartupPageClient
      startup={s}
      compact={true}
      closing={closingId === s.id}
      // A row restored from storage renders already-open, without the drop-in.
      animateOpen={restoreOpenId !== s.id}
      onClose={collapse}
    />
  );

  const listEl = (
    <ul
      ref={listRef}
      role="list"
      onScroll={(e) => {
        scrollTopRef.current = e.currentTarget.scrollTop;
      }}
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
          // Render as the inline card while selected, and keep rendering it
          // through its collapse animation (closingId) before the row returns.
          selected?.id === s.id || closingId === s.id ? (
            <li key={s.id} className="border-b border-border last:border-b-0">
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

      {/* Left: list (always). Startup details expand inline in the list itself;
          the right panel shows the map when toggled on, else its own info. */}
      <div className="flex w-full flex-1 gap-4 overflow-hidden">
        <div
          className="flex flex-col transition-[width] duration-300 ease-in-out"
          style={{ width: isMobile ? "100%" : "66.666%" }}
        >
          {listEl}
        </div>

        <div
          className="flex flex-col overflow-hidden transition-[width,opacity] duration-300 ease-in-out max-md:hidden"
          style={{
            width: isMobile ? "0%" : "33.333%",
            opacity: isMobile ? 0 : 1,
          }}
        >
          {showMap ? (
            <div className="h-full w-full overflow-hidden">{mapEl}</div>
          ) : (
            <div className="flex h-full flex-col overflow-y-auto rounded-xl border border-border bg-bg">
              <StartupDetailPlaceholder />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
