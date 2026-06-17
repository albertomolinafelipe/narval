"use client";

import { useState, useRef } from "react";
import { Rocket } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";

interface BoostButtonProps {
  boosted: boolean;
  count: number;
  isPending?: boolean;
  onClick: () => void;
  showCount?: boolean;
  size?: "default" | "large";
}

export function BoostButton({
  boosted,
  count,
  isPending = false,
  onClick,
  showCount = false,
  size = "default",
}: BoostButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    // Don't allow clicking when already boosted or pending
    if (boosted || isPending) return;

    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 2000); // Match CSS duration

    onClick();
  };

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
            ref={buttonRef}
            type="button"
            onClick={handleClick}
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
