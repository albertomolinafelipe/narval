"use client";

import { useState } from "react";
import { components } from "@/lib/api/generated";
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

type Startup = components["schemas"]["Startup"];

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
  { id: "product", label: "Product", hideWhenEmpty: true, isEmpty: isProductEmpty },
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
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {visibleTabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition sm:px-4 ${
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

      {/* Panel */}
      <div className="py-6">
        {active === "overview" && <OverviewTab startup={startup} />}
        {active === "product" && <ProductTab startup={startup} />}
        {active === "metrics" && <MetricsTab startup={startup} />}
        {active === "contributing" && <ContributingTab startup={startup} />}
        {active === "updates" && (
          <EmptyState
            title="Nothing here yet"
            hint="Roadmap and news will live here."
          />
        )}
      </div>
    </div>
  );
}
