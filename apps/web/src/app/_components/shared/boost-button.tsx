"use client";

import { Rocket } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useBoostAction } from "./use-boost-action";
import { components } from "@/lib/api/generated";

type Startup = components["schemas"]["Startup"];

interface BoostButtonProps {
  startup: Pick<Startup, "id" | "has_boosted" | "boost_count">;
  showCount?: boolean;
  size?: "default" | "large";
}

export function BoostButton({
  startup,
  showCount = false,
  size = "default",
}: BoostButtonProps) {
  const { boosted, count, isPending, isAnimating, boost } =
    useBoostAction(startup);

  const tooltipContent = boosted
    ? "You've boosted this startup"
    : "Boost this startup to give it visibility for 30 days";

  const isLarge = size === "large";
  const iconSize = isLarge ? 20 : 16;
  const buttonClasses = isLarge
    ? "h-10 px-3 gap-2 text-sm font-medium"
    : "h-8 px-2 gap-1.5 text-xs";

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            onClick={boost}
            disabled={isPending}
            className={`flex items-center justify-center rounded-lg transition ${buttonClasses} ${
              boosted
                ? "bg-brand-subtle text-brand-text hover:bg-brand-subtle/80"
                : "text-text-subtle hover:bg-bg-subtle hover:text-text"
            } ${isAnimating ? "boost-animate" : ""} ${
              isPending ? "cursor-wait opacity-70" : ""
            }`}
          >
            <Rocket
              size={iconSize}
              fill={boosted ? "currentColor" : "none"}
              className={isPending ? "animate-pulse" : ""}
            />
            {showCount && (
              <span className="tabular-nums">{count > 0 ? count : ""}</span>
            )}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="rounded-lg border border-border bg-bg-raised px-3 py-2 text-xs text-text shadow-md"
            sideOffset={5}
          >
            {tooltipContent}
            <Tooltip.Arrow className="fill-border" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
