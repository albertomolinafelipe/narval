"use client";

import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import ThirdParty from "supertokens-auth-react/recipe/thirdparty";
import { Button } from "@/components/ui/button";

/**
 * Registration context carried to the Google callback via a short-lived cookie
 * (read server-side in the third-party sign-in override). Omit `intent` for a
 * plain sign-in — the account must already exist.
 */
export interface RegisterIntent {
  account_type: "user" | "startup";
  name: string; // display name / startup name
}

const INTENT_COOKIE = "narval_reg_intent";

export function GoogleButton({
  intent,
  label = "Continue with Google",
  disabled,
}: {
  intent?: RegisterIntent;
  label?: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      if (intent) {
        // Not a secret; carries account type + name across the OAuth round-trip.
        document.cookie = `${INTENT_COOKIE}=${encodeURIComponent(
          JSON.stringify(intent),
        )}; path=/; max-age=600; samesite=lax`;
      }
      const url = await ThirdParty.getAuthorisationURLWithQueryParamsAndSetState({
        thirdPartyId: "google",
        frontendRedirectURI: `${window.location.origin}/auth/callback/google`,
      });
      window.location.assign(url);
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full"
    >
      <FcGoogle size={18} />
      {loading ? "Redirecting…" : label}
    </Button>
  );
}

/** "or" divider for separating Google from the email flow. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-text-muted">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
