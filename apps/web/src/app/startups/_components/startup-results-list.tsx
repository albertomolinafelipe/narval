import type { ReactNode } from "react";
import { X } from "lucide-react";
import { components } from "@/lib/api/generated";
import { Avatar } from "@/app/_components/shared/list-panel";
import { BoostCounter } from "@/app/_components/shared/boost-counter";

type Startup = components["schemas"]["Startup"];

interface Props {
  startups: Startup[];
  title: string;
  subtitle: string;
  onStartupClick: (startup: Startup) => void;
  /** When provided, renders a close/back button in the header. */
  onClose?: () => void;
  /** Show the location alongside the industry in each row. */
  showLocation?: boolean;
  emptyLabel?: string;
  /** Id of the row to render expanded (via `renderExpanded`) instead of a card. */
  selectedId?: string;
  /** Inline detail rendered in place of the selected row's card. */
  renderExpanded?: (startup: Startup) => ReactNode;
}

/**
 * Scrollable list of startup cards used in the map view's side panel — both the
 * full "all startups" list and a single-location group.
 */
export function StartupResultsList({
  startups,
  title,
  subtitle,
  onStartupClick,
  onClose,
  showLocation = false,
  emptyLabel = "No startups found",
  selectedId,
  renderExpanded,
}: Props) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-muted transition hover:bg-bg-subtle hover:text-text"
            aria-label="Back to all startups"
            title="Back to all startups"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Body — scrollable list of startups */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {startups.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">{emptyLabel}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {startups.map((startup) =>
              selectedId === startup.id && renderExpanded ? (
                <li
                  key={startup.id}
                  className="overflow-hidden rounded-lg border border-brand bg-bg"
                >
                  {renderExpanded(startup)}
                </li>
              ) : (
              <li key={startup.id}>
                <button
                  type="button"
                  onClick={() => onStartupClick(startup)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-bg p-3 text-left transition hover:border-brand hover:bg-bg-subtle"
                >
                  <div className="shrink-0">
                    <BoostCounter startup={startup} />
                  </div>
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
                      {showLocation && startup.location && startup.industry && (
                        <span>•</span>
                      )}
                      {showLocation && startup.location && (
                        <span>{startup.location}</span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
