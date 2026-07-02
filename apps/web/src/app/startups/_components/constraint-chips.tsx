import { X } from "lucide-react";
import type { Constraint } from "@/lib/startup/constraints";

interface Props {
  constraints: Constraint[];
  onRemove: (id: string) => void;
}

/**
 * Removable chips for the active search constraints, shown in a wrap-row under
 * the toolbar. Clicking a chip removes that constraint.
 */
export function ConstraintChips({ constraints, onRemove }: Props) {
  if (constraints.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pb-3">
      {constraints.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onRemove(c.id)}
          aria-label={`Remove filter ${c.label}`}
          className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand-subtle px-2.5 py-1 text-xs font-medium text-brand-text transition-colors hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          {c.label}
          <X size={12} className="shrink-0" />
        </button>
      ))}
    </div>
  );
}
