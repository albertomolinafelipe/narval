import { components } from "@/lib/api/generated";

// Enum option lists for select inputs. Each array is typed against the
// generated OpenAPI union, so adding/removing a server enum value without
// updating these (or vice versa) is a compile error — no runtime drift.

type Stage = components["schemas"]["Stage"];
type Industry = components["schemas"]["Industry"];
type FundingRound = components["schemas"]["FundingRound"];

export const STAGES: readonly Stage[] = [
  "idea",
  "pre-seed",
  "seed",
  "series-a",
  "series-b",
  "growth",
  "profitable",
];

export const INDUSTRIES: readonly Industry[] = [
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
];

export const FUNDING_ROUNDS: readonly FundingRound[] = [
  "pre-seed",
  "seed",
  "series-a",
  "series-b",
  "bridge",
];
