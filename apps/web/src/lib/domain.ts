/**
 * Client-side domain helpers, mirroring the server's NormalizeWebsite. Shared by
 * anything that accepts a website/domain input (e.g. domain verification).
 */

/** Extract a bare hostname ("acme.com") from a raw URL or domain string. */
export function extractDomain(url: string): string {
  try {
    if (!url.includes("://")) url = "https://" + url;
    const host = new URL(url).hostname;
    return host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** True when the input resolves to a plausible domain (has a dot, no empty labels). */
export function isValidDomain(raw: string): boolean {
  const host = extractDomain(raw.trim());
  if (!host) return false;
  const parts = host.split(".");
  return parts.length >= 2 && parts.every((p) => p.length > 0);
}
