"use client";

import { Rocket } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";

interface BoostCounterProps {
  count: number;
  boosted: boolean;
  onClick?: () => void;
  clickable?: boolean;
}

export function BoostCounter({
  count,
  boosted,
  onClick,
  clickable = false,
}: BoostCounterProps) {
  const content = (
    <div
      className={`flex min-w-[2.5rem] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
        boosted
          ? "bg-brand-subtle text-brand-text"
          : "bg-bg-subtle text-text-subtle"
      } ${clickable ? "cursor-pointer hover:bg-bg-raised" : ""}`}
      onClick={clickable ? onClick : undefined}
    >
      <Rocket
        size={14}
        fill={boosted ? "currentColor" : "none"}
        className="shrink-0"
      />
      <span className="tabular-nums">{count}</span>
    </div>
  );

  if (!clickable) {
    return content;
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{content}</Tooltip.Trigger>
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
