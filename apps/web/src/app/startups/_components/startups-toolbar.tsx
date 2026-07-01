import { List, Map, Star, Search, TrendingUp, Clock, LayoutList } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";

export type View = "list" | "map";
export type SortMode = "recent" | "trending";

// Matches the ToggleGroup container so standalone (single) toggles look the same.
const singleToggleBox =
  "inline-flex rounded-lg border border-border bg-bg-raised p-0.5 shadow-sm";

interface Props {
  view: View;
  onViewChange: (view: View) => void;
  showFavorites: boolean;
  onFavoritesToggle: () => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
}

/**
 * Controls above the startups list/map. Sort and the detailed-view toggle only
 * apply to the list, so they're hidden in map view.
 */
export function StartupsToolbar({
  view,
  onViewChange,
  showFavorites,
  onFavoritesToggle,
  sort,
  onSortChange,
  expanded,
  onExpandedChange,
  query,
  onQueryChange,
}: Props) {
  return (
    <div className="flex items-center gap-2 pb-3">
      <ToggleGroup
        type="single"
        value={view}
        // Single-select must always keep a value — ignore deselection (empty).
        onValueChange={(v) => v && onViewChange(v as View)}
      >
        <ToggleGroupItem value="list">
          <List size={13} />
          List
        </ToggleGroupItem>
        <ToggleGroupItem value="map">
          <Map size={13} />
          Map
        </ToggleGroupItem>
      </ToggleGroup>

      <div className={singleToggleBox}>
        <Toggle pressed={showFavorites} onPressedChange={onFavoritesToggle}>
          <Star size={13} fill={showFavorites ? "currentColor" : "none"} />
          Favorites
        </Toggle>
      </div>

      {view === "list" && (
        <>
          <ToggleGroup
            type="single"
            value={sort}
            onValueChange={(v) => v && onSortChange(v as SortMode)}
          >
            <ToggleGroupItem value="recent">
              <Clock size={13} />
              Recent
            </ToggleGroupItem>
            <ToggleGroupItem value="trending">
              <TrendingUp size={13} />
              Trending
            </ToggleGroupItem>
          </ToggleGroup>

          <div className={`${singleToggleBox} max-md:hidden`}>
            <Toggle pressed={expanded} onPressedChange={onExpandedChange}>
              <LayoutList size={13} />
              Details
            </Toggle>
          </div>
        </>
      )}

      <div className="relative w-56">
        <Search
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Filter startups…"
          className="h-8 pl-8 pr-3 text-xs"
        />
      </div>
    </div>
  );
}
