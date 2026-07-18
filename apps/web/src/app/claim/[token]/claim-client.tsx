"use client";

import { useEffect, useRef, useState } from "react";
import AppHeader from "@/app/_components/layout/app-header";
import StartupPageClient from "@/app/startups/startup-page-client";
import { Button } from "@/components/ui/button";
import {
  getClaimStartup,
  startClaim,
  verify as verifyOtp,
} from "@/lib/api/gen";
import type { Startup } from "@/lib/api/gen";
import { unwrap } from "@/lib/api/unwrap";

export default function ClaimClient({ token }: { token: string }) {
  const [shell, setShell] = useState<Startup | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    unwrap(getClaimStartup({ path: { token } }))
      .then((s) => active && setShell(s))
      .catch(() => active && setLoadError(true));
    return () => {
      active = false;
    };
  }, [token]);

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-bg px-6 text-center">
        <h1 className="text-lg font-semibold text-text">
          This claim link is no longer valid
        </h1>
        <p className="text-sm text-text-muted">
          It may have already been claimed. Ask whoever sent it for a fresh
          link.
        </p>
      </div>
    );
  }

  if (!shell) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <p className="text-sm text-text-muted">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-bg">
      <AppHeader customTab={{ label: shell.name }} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <ClaimPanel token={token} shell={shell} />
        <StartupPageClient startup={shell} />
      </main>
    </div>
  );
}

// The email → OTP flow that binds the shell to whoever verifies their email.
function ClaimPanel({ token, shell }: { token: string; shell: Startup }) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await unwrap(startClaim({ body: { email: email.trim(), token } }));
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(c: string) {
    if (submitted.current) return;
    submitted.current = true;
    setError("");
    setSubmitting(true);
    try {
      await unwrap(verifyOtp({ body: { email: email.trim(), code: c } }));
      // Full reload so the new session + user context load, then land on the
      // editable profile the claimant now owns.
      window.location.href = `/startups/in/${shell.id}/edit`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      submitted.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto mt-4 max-w-5xl rounded-xl border border-[var(--color-wip-text)] bg-[var(--color-wip-text)]/10 px-4 py-4">
      <p className="text-sm font-medium text-text">
        This profile for {shell.name} was set up for you
      </p>
      <p className="mt-0.5 text-xs text-text-muted">
        Verify your email to take ownership — then you can edit everything
        below.
      </p>

      {step === "email" ? (
        <form
          onSubmit={sendCode}
          className="mt-3 flex flex-col gap-2 sm:flex-row"
        >
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            required
            autoComplete="email"
            className="input sm:max-w-xs"
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending code…" : "Claim this profile"}
          </Button>
        </form>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-text-muted">
            A 6-digit code was sent to{" "}
            <span className="font-medium text-text">{email}</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6) verify(v);
              }}
              autoComplete="one-time-code"
              autoFocus
              className="input text-center tracking-widest sm:max-w-xs"
            />
            <Button
              type="button"
              onClick={() => verify(code)}
              disabled={submitting || code.length !== 6}
            >
              {submitting ? "Verifying…" : "Verify & claim"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
