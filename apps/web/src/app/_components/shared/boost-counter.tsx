"use client";

import { Rocket } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useBoostAction } from "./use-boost-action";
import { components } from "@/lib/api/generated";

type Startup = components["schemas"]["Startup"];

interface BoostCounterProps {
  startup: Pick<Startup, "id" | "has_boosted" | "boost_count">;
}

export function BoostCounter({ startup }: BoostCounterProps) {
  const { boosted, count, isPending, isAnimating, boost } =
    useBoostAction(startup);

  // Rendered as a div (not a button) because it lives inside the row's
  // clickable <button>; stopPropagation keeps boosting from navigating.
  const handleBoost = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    boost();
  };

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div
            role="button"
            tabIndex={0}
            aria-label={boosted ? "You've boosted this" : "Boost this startup"}
            onClick={handleBoost}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleBoost(e);
              }
            }}
            className={`flex min-w-[2.5rem] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
              boosted
                ? "bg-brand-subtle text-brand-text"
                : "bg-bg-subtle text-text-subtle hover:bg-bg-raised"
            } ${isAnimating ? "boost-animate" : ""} ${
              isPending ? "cursor-wait opacity-70" : "cursor-pointer"
            }`}
          >
            <Rocket
              size={14}
              fill={boosted ? "currentColor" : "none"}
              className="shrink-0"
            />
            <span className="tabular-nums">{count}</span>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="rounded-lg border border-border bg-bg-raised px-3 py-2 text-xs text-text shadow-md"
            sideOffset={5}
          >
            {boosted ? "You've boosted this" : "Click to boost"}
            <Tooltip.Arrow className="fill-border" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
