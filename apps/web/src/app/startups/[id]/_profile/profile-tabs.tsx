"use client";

import { useState } from "react";
import { components } from "@/lib/api/generated";
import { OverviewTab } from "./overview-tab";
import { ProductTab } from "./product-tab";
import { MetricsTab } from "./metrics-tab";
import { ContributingTab } from "./contributing-tab";
import { EmptyState } from "./ui";

type Startup = components["schemas"]["Startup"];

type TabId = "overview" | "product" | "metrics" | "contributing" | "updates";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "product", label: "Product" },
  { id: "metrics", label: "Metrics" },
  { id: "contributing", label: "Contributing" },
  { id: "updates", label: "Updates" },
];

export function ProfileTabs({ startup }: { startup: Startup }) {
  const [active, setActive] = useState<TabId>("overview");

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
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
