import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Bordered container for a group of {@link SegmentButton}s. */
export function Segmented({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-border bg-bg-raised p-0.5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A single pill button inside a {@link Segmented} control. */
export function SegmentButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-bg-subtle text-text shadow-sm"
          : "text-text-muted hover:text-text",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
