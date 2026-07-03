import { useState } from "react";
import {
  Map,
  Star,
  Search,
  TrendingUp,
  Clock,
  LayoutList,
  SlidersHorizontal,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SlideSwitch } from "@/components/ui/slide-switch";
import { ToggleButton } from "@/components/ui/toggle-button";
import { Input } from "@/components/ui/input";

export type View = "list" | "map";
export type SortMode = "recent" | "trending";

// Brand-filled active state shared by the on/off SlideSwitch toggles.
const activeSwitch = "border-brand bg-brand hover:bg-brand-hover";

// Pill treatment for the segmented sort control: fully rounded, softer border,
// and a brand-filled active segment.
const viewToggleBox = "rounded-full border-border/60 bg-bg-subtle p-1 shadow-none";
const viewToggleItem =
  "rounded-full px-3 py-1 data-[state=on]:bg-brand data-[state=on]:text-brand-fg data-[state=on]:shadow-sm";

interface Props {
  showMap: boolean;
  onShowMapChange: (showMap: boolean) => void;
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
 * Controls above the startups list. Map is an on/off toggle that swaps the right
 * panel for a map; the detailed-view toggle only affects the list rows.
 */
export function StartupsToolbar({
  showMap,
  onShowMapChange,
  showFavorites,
  onFavoritesToggle,
  sort,
  onSortChange,
  expanded,
  onExpandedChange,
  query,
  onQueryChange,
}: Props) {
  // On mobile the extra controls collapse behind the filters button.
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sort + favorites + details, shared by the desktop inline row and the
  // collapsible mobile row. Details is desktop-only and hides itself there.
  const controls = (
    <>
      <ToggleGroup
        type="single"
        value={sort}
        className={viewToggleBox}
        onValueChange={(v) => v && onSortChange(v as SortMode)}
      >
        <ToggleGroupItem value="recent" className={viewToggleItem}>
          <Clock size={13} />
          Recent
        </ToggleGroupItem>
        <ToggleGroupItem value="trending" className={viewToggleItem}>
          <TrendingUp size={13} />
          Trending
        </ToggleGroupItem>
      </ToggleGroup>

      <label className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Favorites</span>
        <SlideSwitch
          checked={showFavorites}
          onCheckedChange={onFavoritesToggle}
          checkedClassName={activeSwitch}
          aria-label="Toggle favorites only"
        >
          <Star size={13} fill={showFavorites ? "currentColor" : "none"} />
        </SlideSwitch>
      </label>

      <label className="flex items-center gap-2 max-md:hidden">
        <span className="text-xs font-medium text-text-muted">Details</span>
        <SlideSwitch
          checked={expanded}
          onCheckedChange={onExpandedChange}
          checkedClassName={activeSwitch}
          aria-label="Toggle detailed view"
        >
          <LayoutList size={13} />
        </SlideSwitch>
      </label>
    </>
  );

  return (
    <div className="flex flex-col gap-2 pb-3">
      <div className="flex items-center gap-2">
        {/* Search fills the row; the buttons after it stay pinned to the right. */}
        <div className="relative min-w-0 flex-1 md:w-56 md:flex-none">
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Filter startups…"
            className="h-8 rounded-full border-border/60 bg-bg-subtle pl-9 pr-4 text-xs"
          />
        </div>

        {/* Mobile-only: reveals the extra controls in a second row. */}
        <ToggleButton
          checked={showAdvanced}
          onCheckedChange={setShowAdvanced}
          checkedClassName={activeSwitch}
          aria-label="More filters"
          className="shrink-0 md:hidden"
        >
          <SlidersHorizontal size={13} />
        </ToggleButton>

        <label className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-text-muted max-md:hidden">
            Map
          </span>
          <SlideSwitch
            checked={showMap}
            onCheckedChange={onShowMapChange}
            checkedClassName={activeSwitch}
            aria-label="Toggle map"
          >
            <Map size={13} />
          </SlideSwitch>
        </label>

        {/* Desktop: controls inline; mobile hides them behind the filters button. */}
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          {controls}
        </div>
      </div>

      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-2 md:hidden">
          {controls}
        </div>
      )}
    </div>
  );
}
