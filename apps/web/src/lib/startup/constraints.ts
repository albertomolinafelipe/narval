/**
 * Selector layer for startup search "constraints" — the single source of truth
 * for how any filter (a clicked map pin, a field predicate like "founded ≥ 2020",
 * future advanced filters) narrows the startup list. See AGENTS.md → "Search
 * constraints".
 *
 * A constraint is just a predicate over a `Startup` plus a display label. The
 * visible list is every startup passing *all* active constraints (AND). Adding a
 * new filter type means writing one more factory here — nothing else changes.
 */
import type { components } from "@/lib/api/generated";

type Startup = components["schemas"]["Startup"];

export interface Constraint {
  /** Stable identity — dedupes and drives add/remove toggling. */
  id: string;
  /** Chip text, e.g. "Madrid" or "Founded ≥ 2020". */
  label: string;
  /** True when the startup satisfies this constraint. */
  test: (startup: Startup) => boolean;
}

/** Startups passing every active constraint. */
export function applyConstraints(
  startups: Startup[],
  constraints: Constraint[],
): Startup[] {
  if (constraints.length === 0) return startups;
  return startups.filter((s) => constraints.every((c) => c.test(s)));
}

/** Add the constraint if absent, or remove it if its id is already present. */
export function toggleConstraint(
  constraints: Constraint[],
  next: Constraint,
): Constraint[] {
  return constraints.some((c) => c.id === next.id)
    ? constraints.filter((c) => c.id !== next.id)
    : [...constraints, next];
}

// --- Factories: one per filter type -----------------------------------------

/** Restrict to startups whose location string matches exactly. */
export function locationConstraint(location: string): Constraint {
  return {
    id: `location:${location}`,
    label: location,
    test: (s) => s.location === location,
  };
}

/** Restrict to startups founded in or after `year`. Example field constraint. */
export function foundedAtLeastConstraint(year: number): Constraint {
  return {
    id: `founded-gte:${year}`,
    label: `Founded ≥ ${year}`,
    test: (s) => (s.founded_year ?? 0) >= year,
  };
}
