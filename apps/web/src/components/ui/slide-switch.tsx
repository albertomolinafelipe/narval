"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SlideSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Icon rendered inside the sliding knob. */
  children: React.ReactNode;
  "aria-label": string;
  className?: string;
}

/**
 * A sliding on/off switch: a rounded track with a circular knob that translates
 * from left (off) to right (on). The knob holds a caller-supplied icon.
 */
export function SlideSwitch({
  checked,
  onCheckedChange,
  children,
  className,
  ...props
}: SlideSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-8 w-14 items-center rounded-full border border-border bg-bg-subtle p-1 shadow-sm transition-colors hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full bg-bg text-text shadow-sm transition-transform duration-300 ease-in-out",
          checked ? "translate-x-[22px]" : "translate-x-0",
        )}
      >
        {children}
      </span>
    </button>
  );
}
