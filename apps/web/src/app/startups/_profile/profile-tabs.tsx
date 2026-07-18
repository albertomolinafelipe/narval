"use client";

import { useState } from "react";
import type { Startup } from "@/lib/api/gen";
import { useProfileEdit } from "./edit-context";
import { OverviewTab } from "./overview-tab";
import { ProductTab } from "./product-tab";
import { MetricsTab } from "./metrics-tab";
import { ContributingTab, isContributingEmpty } from "./contributing-tab";
import { EmptyState } from "./ui";

function isProductEmpty(startup: Startup): boolean {
  try {
    const g = JSON.parse(startup.gallery ?? "[]");
    return !Array.isArray(g) || g.length === 0;
  } catch {
    return true;
  }
}

type TabId = "overview" | "product" | "metrics" | "contributing" | "updates";

interface TabDef {
  id: TabId;
  label: string;
  /** Hidden from visitors when isEmpty(startup) is true (owner always sees it). */
  hideWhenEmpty?: boolean;
  isEmpty?: (startup: Startup) => boolean;
}

const TABS: TabDef[] = [
  { id: "overview", label: "Overview" },
  {
    id: "product",
    label: "Product",
    hideWhenEmpty: true,
    isEmpty: isProductEmpty,
  },
  { id: "metrics", label: "Metrics" },
  {
    id: "contributing",
    label: "Contributing",
    hideWhenEmpty: true,
    isEmpty: isContributingEmpty,
  },
  { id: "updates", label: "Updates" },
];

export function ProfileTabs({ startup }: { startup: Startup }) {
  const { isOwner } = useProfileEdit();
  const [active, setActive] = useState<TabId>("overview");

  const visibleTabs = TABS.filter(
    (tab) => isOwner || !(tab.hideWhenEmpty && tab.isEmpty?.(startup)),
  );

  return (
    <div className="flex flex-col">
      {/* Tab bar — scrolls horizontally when the tabs overflow (mobile).
          Scrollbar is hidden; a right-edge fade hints at more tabs. */}
      <div className="relative">
        <div className="no-scrollbar flex overflow-x-auto overflow-y-hidden border-b border-border">
          {visibleTabs.map((tab) => {
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition sm:px-4 ${
                  isActive
                    ? "border-brand text-text"
                    : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg to-transparent" />
      </div>

      {/* Panel */}
      <div className="py-6">
        {active === "overview" && <OverviewTab startup={startup} />}
        {active === "product" && <ProductTab startup={startup} />}
        {active === "metrics" && <MetricsTab startup={startup} />}
        {active === "contributing" && <ContributingTab startup={startup} />}
        {active === "updates" && (
          <EmptyState title="Coming soon" hint="Roadmap and news." />
        )}
      </div>
    </div>
  );
}
