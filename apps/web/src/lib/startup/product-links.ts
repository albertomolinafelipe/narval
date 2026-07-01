/**
 * Selector layer for the `Startup` entity — pure, JSX-free derivations shared by
 * every view (list row, compact panel, full page). See AGENTS.md → "Rendering
 * pattern — one entity, many views".
 */

/**
 * `product_links` is stored as a JSON string (`{ web, ios, android }`). Parse it
 * defensively — a malformed value yields an empty object rather than throwing.
 */
export function parseProductLinks(raw?: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
