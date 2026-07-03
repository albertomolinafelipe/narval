"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ToggleButtonProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Icon rendered inside the inner knob. */
  children: React.ReactNode;
  "aria-label": string;
  className?: string;
  /** Extra track classes applied only in the on state (e.g. a brand fill). */
  checkedClassName?: string;
}

/**
 * The round sibling of {@link SlideSwitch}: a circular track holding a centered
 * circular knob with an icon. Same on/off toggle semantics, but the knob stays
 * put instead of sliding — reads as a button rather than a switch.
 */
export function ToggleButton({
  checked,
  onCheckedChange,
  children,
  className,
  checkedClassName,
  ...props
}: ToggleButtonProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-subtle p-1 shadow-sm transition-colors hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        className,
        checked && checkedClassName,
      )}
      {...props}
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-bg text-text shadow-sm">
        {children}
      </span>
    </button>
  );
}
