/**
 * Shared display variants for rendering an entity (Startup, User, …) across
 * different contexts. A variant is a content/context *density*, e.g. the full
 * page vs a compact side panel — NOT a screen size (handle responsiveness with
 * Tailwind breakpoints inside a variant, not a separate variant).
 *
 * See AGENTS.md → "Rendering pattern — one entity, many views".
 */
export type ViewVariant = "full" | "compact";
