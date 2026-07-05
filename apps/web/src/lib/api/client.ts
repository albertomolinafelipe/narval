import createClient from "openapi-fetch";
import type { paths, components } from "./generated";

// The generated file is created by: npm run generate
// which reads apps/server/api/openapi.yaml

export const API_URL =
  process.env.INTERNAL_API_URL ?? "http://localhost:8080/api/v1";

export const apiClient = createClient<paths>({
  baseUrl: API_URL,
});

/**
 * Create an authenticated API client that forwards session cookies.
 * With SuperTokens, sessions are automatically managed via cookies, so this
 * is mainly for server-side calls where you need to explicitly pass credentials.
 * 
 * For client-side calls, SuperTokens automatically includes session cookies.
 */
export function createAuthenticatedClient(accessToken?: string) {
  const headers: HeadersInit = {};
  
  // If accessToken is provided (for backward compatibility with server-side calls),
  // include it. Otherwise, rely on cookies for SuperTokens session.
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return createClient<paths>({
    baseUrl: API_URL,
    headers,
  });
}

export async function apiFetch<T>(
  fn: () => Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await fn();
  if (!response.ok || error) {
    throw new Error(
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : `Request failed: ${response.status}`,
    );
  }
  return data as T;
}

// Types for React Query hooks
type Startup = components["schemas"]["Startup"];

export interface FetchStartupsOptions {
  favorited?: boolean;
  accessToken?: string;
  sort?: "recent" | "trending";
}

export interface FetchStartupOptions {
  accessToken?: string;
}

/**
 * Fetch all startups with optional filtering.
 * For use with React Query on the client side.
 * SuperTokens automatically includes session cookies for auth.
 */
export async function fetchStartups(
  options: FetchStartupsOptions = {},
): Promise<Startup[]> {
  const { favorited, accessToken, sort } = options;

  const url = new URL("/api/proxy/startups", window.location.origin);
  if (favorited) {
    url.searchParams.set("favorited", "true");
  }
  if (sort && sort !== "recent") {
    url.searchParams.set("sort", sort);
  }

  const headers: HeadersInit = {};
  // accessToken is optional - SuperTokens uses cookies by default
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url.toString(), {
    headers,
    cache: "no-store",
    credentials: "include", // Important: include cookies for SuperTokens session
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch startups: ${response.statusText}`);
  }

  return response.json();
}

export type Stats = components["schemas"]["Stats"];

/** Fetch aggregate directory counts (startups + users). Public, no auth. */
export async function fetchStats(): Promise<Stats> {
  const url = new URL("/api/proxy/stats", window.location.origin);
  const response = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch a single startup by ID.
 * For use with React Query on the client side.
 * SuperTokens automatically includes session cookies for auth.
 */
export async function fetchStartup(
  id: string,
  options: FetchStartupOptions = {},
): Promise<Startup | null> {
  const { accessToken } = options;

  const headers: HeadersInit = {};
  // accessToken is optional - SuperTokens uses cookies by default
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  // Handle both server-side and client-side contexts. `id` may be a UUID or a
  // verified domain (e.g. acme.com); the backend resolves either.
  const isServer = typeof window === "undefined";
  const handle = encodeURIComponent(id);
  const url = isServer
    ? `${API_URL}/startups/${handle}`
    : `/api/proxy/startups/${handle}`;

  const response = await fetch(url, {
    headers,
    cache: "no-store",
    credentials: "include", // Important: include cookies for SuperTokens session
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null; // Return null for 404, let page component call notFound()
    }
    throw new Error(`Failed to fetch startup: ${response.statusText}`);
  }

  return response.json();
}

export type StartupImageKind = "logo" | "banner";

/**
 * Upload (or replace) a startup's logo or banner. The multipart field name
 * matches the image kind, mirroring the backend handlers. Returns the updated
 * startup. SuperTokens session cookies are automatically included.
 */
export async function uploadStartupImage(
  id: string,
  kind: StartupImageKind,
  blob: Blob,
): Promise<Startup> {
  const form = new FormData();
  form.append(kind, blob, `${kind}.jpg`);

  // Don't set Content-Type — the browser adds the multipart boundary.
  const response = await fetch(`/api/proxy/startups/${id}/${kind}`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to upload ${kind}`);
  }

  return response.json();
}

/**
 * Upload a founder photo and get back its public URL. The caller stores the URL
 * inside the startup's founders JSON (this endpoint does not touch the startup).
 * SuperTokens session cookies are automatically included.
 */
export async function uploadFounderPhoto(
  id: string,
  blob: Blob,
): Promise<string> {
  const form = new FormData();
  form.append("photo", blob, "founder.jpg");

  const response = await fetch(`/api/proxy/startups/${id}/founder-photo`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to upload photo");
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

/**
 * Upload a product screenshot and get back its public URL. The caller stores the
 * URL inside the startup's gallery JSON array (this endpoint does not touch the
 * startup). SuperTokens session cookies are automatically included.
 */
export async function uploadScreenshot(
  id: string,
  blob: Blob,
): Promise<string> {
  const form = new FormData();
  form.append("screenshot", blob, "screenshot.jpg");

  const response = await fetch(`/api/proxy/startups/${id}/screenshot`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to upload screenshot");
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

/**
 * Remove a startup's logo or banner. Returns the updated startup.
 * SuperTokens session cookies are automatically included.
 */
export async function deleteStartupImage(
  id: string,
  kind: StartupImageKind,
): Promise<Startup> {
  const response = await fetch(`/api/proxy/startups/${id}/${kind}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to remove ${kind}`);
  }

  return response.json();
}

/**
 * Toggle favorite status for a startup.
 * SuperTokens session cookies are automatically included.
 */
export async function toggleFavorite(
  id: string,
  isFavorited: boolean,
  accessToken?: string,
): Promise<void> {
  const method = isFavorited ? "DELETE" : "POST";
  const headers: HeadersInit = {};
  
  // accessToken is optional - SuperTokens uses cookies by default
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`/api/proxy/startups/${id}/bookmark`, {
    method,
    headers,
    credentials: "include", // Important: include cookies for SuperTokens session
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to ${isFavorited ? "unfavorite" : "favorite"} startup`,
    );
  }
}

/**
 * Boost a startup (one-time action that expires in 7 days).
 * SuperTokens session cookies are automatically included.
 */
export async function boostStartup(
  id: string,
  accessToken?: string,
): Promise<void> {
  const headers: HeadersInit = {};
  
  // accessToken is optional - SuperTokens uses cookies by default
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`/api/proxy/startups/${id}/boost`, {
    method: "POST",
    headers,
    credentials: "include", // Important: include cookies for SuperTokens session
  });

  if (!response.ok) {
    if (response.status === 409) {
      // Already boosted - this is okay, treat as success
      return;
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to boost startup");
  }
}

/**
 * Start domain verification: emails a one-time code to <emailPrefix>@<domain>.
 * SuperTokens session cookies are automatically included.
 */
export async function startDomainVerification(
  id: string,
  website: string,
  emailPrefix: string,
): Promise<{ email: string }> {
  const response = await fetch(`/api/proxy/startups/${id}/verify-domain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ website, email_prefix: emailPrefix }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };
    if (body.code === "SUBDOMAIN_NOT_ALLOWED")
      throw new Error("Use your root domain (e.g. example.com, not app.example.com).");
    if (body.code === "PUBLIC_DOMAIN")
      throw new Error("That's a personal email provider. Use your company domain.");
    if (response.status === 409)
      throw new Error(body.message ?? "This domain is already verified by another startup.");
    throw new Error(body.message ?? "Failed to start verification.");
  }

  return response.json();
}

/**
 * Confirm domain verification with the emailed code. Returns the updated,
 * now-verified startup. SuperTokens session cookies are automatically included.
 */
export async function confirmDomainVerification(
  id: string,
  code: string,
): Promise<Startup> {
  const response = await fetch(
    `/api/proxy/startups/${id}/verify-domain/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code }),
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Verification failed.");
  }

  return response.json();
}

/**
 * Partially update a startup. Only the fields present in `patch` are changed;
 * the server leaves omitted fields untouched. Returns the updated startup.
 * SuperTokens session cookies are automatically included.
 */
export async function updateStartup(
  id: string,
  patch: components["schemas"]["UpdateStartupRequest"],
): Promise<Startup> {
  const response = await fetch(`/api/proxy/startups/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // Important: include cookies for SuperTokens session
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to update startup");
  }

  return response.json();
}

// ─── Admin-seeded shells + claim flow ────────────────────────────────────────

/** Admin only: create an unclaimed shell owned by the admin. Returns the new id
 * and the claim token to hand to the startup. */
export async function createAdminStartup(
  name: string,
): Promise<{ id: string; name: string; claim_token: string }> {
  const response = await fetch(`/api/proxy/admin/startups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Failed to create profile");
  }
  return response.json();
}

/** Owner only: fetch the claim token for a shell so the admin can (re)copy the
 * claim link from the edit page. `claim_token` is empty once claimed. */
export async function getClaimLink(
  id: string,
): Promise<{ claimed: boolean; claim_token: string }> {
  const response = await fetch(`/api/proxy/startups/${id}/claim-link`, {
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Failed to load claim link");
  }
  return response.json();
}

/** Public: fetch an unclaimed shell by its claim token to preview on the claim page. */
export async function getClaimStartup(token: string): Promise<Startup> {
  const response = await fetch(`/api/proxy/claim/${token}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "This claim link is invalid or already used");
  }
  return response.json();
}

/** Public: begin claiming a shell — sends an OTP to the startup's email. */
export async function startClaim(email: string, token: string): Promise<void> {
  const response = await fetch(`/api/proxy/auth/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, token }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Failed to send verification code");
  }
}
