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

// --- Advanced-filter options ------------------------------------------------
// The canonical option lists shown in the advanced-filter panel, mirroring the
// server's `validIndustries` / `validStages` (handler.go). Kept here beside the
// factories so the filter surface has a single source of truth.

export const INDUSTRIES = [
  "AI/ML",
  "FinTech",
  "HealthTech",
  "Climate Tech",
  "EdTech",
  "SaaS",
  "Marketplace",
  "Developer Tools",
  "Hardware",
  "Consumer",
  "Deep Tech",
  "Logistics",
  "Legal Tech",
  "HR Tech",
  "Other",
] as const;

export const STAGES = [
  "idea",
  "pre-seed",
  "seed",
  "series-a",
  "series-b",
  "growth",
  "profitable",
] as const;

/** Human-readable labels for the stored stage slugs. */
export const STAGE_LABELS: Record<string, string> = {
  idea: "Idea",
  "pre-seed": "Pre-seed",
  seed: "Seed",
  "series-a": "Series A",
  "series-b": "Series B",
  growth: "Growth",
  profitable: "Profitable",
};

/** "AI/ML" or "AI/ML +2" — compact chip summary of a multi-select. */
function summarize(values: string[], render: (v: string) => string = (v) => v) {
  const [first, ...rest] = values;
  return rest.length ? `${render(first)} +${rest.length}` : render(first);
}

// --- Multi-select field constraints -----------------------------------------
// Each is one constraint testing set membership, so selecting several values
// within a field is OR within the field while still AND-ing across fields.
// Returns null when nothing is selected (nothing to constrain).

/** Restrict to startups whose industry is one of `industries`. */
export function industryInConstraint(industries: string[]): Constraint | null {
  if (industries.length === 0) return null;
  return {
    id: "industries",
    label: `Industry: ${summarize(industries)}`,
    test: (s) => industries.includes(s.industry ?? ""),
  };
}

/** Restrict to startups whose stage is one of `stages`. */
export function stageInConstraint(stages: string[]): Constraint | null {
  if (stages.length === 0) return null;
  return {
    id: "stages",
    label: `Stage: ${summarize(stages, (v) => STAGE_LABELS[v] ?? v)}`,
    test: (s) => stages.includes(s.stage ?? ""),
  };
}

/** Toggle `value` in/out of a multi-select list (immutably). */
export function toggleValue(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

/**
 * Fixed, non-linear stops for the team-size slider — fine at the low end where
 * startup headcounts cluster, coarse higher up. Each stop is one slider notch
 * (evenly spaced), so the scale is independent of the data. The last stop is
 * treated as an open-ended upper bound ("1000+").
 */
export const TEAM_SCALE = [
  1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500, 1000,
] as const;

// --- Range field constraints ------------------------------------------------
// Inclusive numeric bounds. Startups with a missing/zero value (0) fall outside
// any non-trivial range, so they drop out once the user narrows the field.

/** Restrict to startups founded within [min, max] (inclusive). */
export function foundedRangeConstraint(min: number, max: number): Constraint {
  return {
    id: "founded",
    label: `Founded ${min}–${max}`,
    test: (s) => {
      const y = s.founded_year ?? 0;
      return y >= min && y <= max;
    },
  };
}

/**
 * Restrict to startups whose team size is within [min, max] (inclusive). Pass
 * `Infinity` as max for the open-ended top of the scale ("1000+").
 */
export function teamSizeRangeConstraint(min: number, max: number): Constraint {
  return {
    id: "team",
    label: max === Infinity ? `Team ${min}+` : `Team ${min}–${max}`,
    test: (s) => {
      const n = s.team_size ?? 0;
      return n >= min && n <= max;
    },
  };
}
