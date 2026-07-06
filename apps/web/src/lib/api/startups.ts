import { getStartup } from "./gen";
import type { Startup } from "./gen";

// Server-side fetch for a startup by UUID or verified domain. Returns null on
// 404 so route handlers can call notFound(). Runs unauthenticated (no session
// cookies server-side); the client detail hook refetches with the user's
// session to fill in auth-only fields like is_favorited.
export async function getStartupById(id: string): Promise<Startup | null> {
  const { data, response } = await getStartup({ path: { id } });
  if (response?.status === 404) return null;
  if (!response?.ok || !data) {
    throw new Error(`Failed to fetch startup: ${response?.status ?? "network error"}`);
  }
  return data;
}
