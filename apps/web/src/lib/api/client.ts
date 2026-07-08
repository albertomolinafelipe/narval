import type { components } from "./generated";

// App API calls whose endpoints aren't in the OpenAPI spec yet (admin/claim
// flow, founder-photo/screenshot uploads) or are pending migration to the
// generated SDK (domain verification, stats). Everything here proxies through
// /api/proxy so SuperTokens session cookies are forwarded.
//
// As endpoints land in the spec, migrate these onto the generated client in
// src/lib/api/gen and delete them from here.

type Startup = components["schemas"]["Startup"];

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
      throw new Error(
        "Use your root domain (e.g. example.com, not app.example.com).",
      );
    if (body.code === "PUBLIC_DOMAIN")
      throw new Error(
        "That's a personal email provider. Use your company domain.",
      );
    if (response.status === 409)
      throw new Error(
        body.message ?? "This domain is already verified by another startup.",
      );
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
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(body.message ?? "Verification failed.");
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
    throw new Error(
      body.message || "This claim link is invalid or already used",
    );
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
