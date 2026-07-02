"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThirdParty from "supertokens-auth-react/recipe/thirdparty";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type State =
  | { status: "loading" }
  | { status: "no-account" }
  | { status: "error"; message: string };

export default function GoogleCallbackPage() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const res = await ThirdParty.signInAndUp();
        if (res.status === "OK") {
          // Full navigation so the new session cookie is picked up everywhere.
          window.location.assign("/startups");
          return;
        }
        setState({ status: "error", message: "Could not complete sign-in." });
      } catch (err) {
        // The backend rejects unknown-email sign-ins with a NO_ACCOUNT general error.
        const message = err instanceof Error ? err.message : "";
        if (message === "NO_ACCOUNT") {
          setState({ status: "no-account" });
        } else {
          setState({ status: "error", message: "Could not complete sign-in." });
        }
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        {state.status === "loading" && (
          <>
            <Loader2 className="animate-spin text-brand" size={28} />
            <p className="text-sm text-text-muted">Signing you in…</p>
          </>
        )}

        {state.status === "no-account" && (
          <>
            <h1 className="text-lg font-semibold text-text">No account found</h1>
            <p className="text-sm text-text-muted">
              We couldn&apos;t find an account for that Google email. Create one to
              get started.
            </p>
            <Button asChild className="w-full">
              <Link href="/">Back to Narval</Link>
            </Button>
          </>
        )}

        {state.status === "error" && (
          <>
            <h1 className="text-lg font-semibold text-text">Something went wrong</h1>
            <p className="text-sm text-text-muted">{state.message}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Back home</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
