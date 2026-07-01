import { List, Map, Star, Search, TrendingUp, Clock, LayoutList } from "lucide-react";
import { Segmented, SegmentButton } from "@/app/_components/shared/segmented";

export type View = "list" | "map";
export type SortMode = "recent" | "trending";

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
      <Segmented>
        <SegmentButton
          active={view === "list"}
          onClick={() => onViewChange("list")}
          icon={<List size={13} />}
        >
          List
        </SegmentButton>
        <SegmentButton
          active={view === "map"}
          onClick={() => onViewChange("map")}
          icon={<Map size={13} />}
        >
          Map
        </SegmentButton>
      </Segmented>

      <Segmented>
        <SegmentButton
          active={showFavorites}
          onClick={onFavoritesToggle}
          icon={<Star size={13} fill={showFavorites ? "currentColor" : "none"} />}
        >
          Favorites
        </SegmentButton>
      </Segmented>

      {view === "list" && (
        <>
          <Segmented>
            <SegmentButton
              active={sort === "recent"}
              onClick={() => onSortChange("recent")}
              icon={<Clock size={13} />}
            >
              Recent
            </SegmentButton>
            <SegmentButton
              active={sort === "trending"}
              onClick={() => onSortChange("trending")}
              icon={<TrendingUp size={13} />}
            >
              Trending
            </SegmentButton>
          </Segmented>

          <Segmented className="max-md:hidden">
            <SegmentButton
              active={expanded}
              onClick={() => onExpandedChange(!expanded)}
              icon={<LayoutList size={13} />}
            >
              Details
            </SegmentButton>
          </Segmented>
        </>
      )}

      <div className="relative w-56">
        <Search
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Filter startups…"
          className="h-8 w-full rounded-lg border border-border bg-bg-raised pl-8 pr-3 text-xs text-text placeholder:text-text-subtle outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
        />
      </div>
    </div>
  );
}
