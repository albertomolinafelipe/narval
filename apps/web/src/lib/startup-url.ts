/**
 * Single source of truth for building links to a startup profile.
 *
 * Verified startups have a clean public URL at `/startups/<domain>`; everything
 * else lives at the internal canonical `/startups/in/<uuid>`. UUID remains the
 * only internal identity — the domain is purely a public URL alias.
 */
export function startupPath(startup: {
  id: string;
  verified?: boolean;
  verified_domain?: string;
}): string {
  if (startup.verified && startup.verified_domain) {
    return `/startups/${startup.verified_domain}`;
  }
  return `/startups/in/${startup.id}`;
}

/**
 * Owner-only edit route. Editing is an internal action, always addressed by
 * UUID regardless of whether the startup has a verified public URL.
 */
export function startupEditPath(startup: { id: string }): string {
  return `/startups/in/${startup.id}/edit`;
}
