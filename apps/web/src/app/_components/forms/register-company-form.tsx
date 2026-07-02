"use client";

import { useState, useRef } from "react";
import { useRouter as useNextRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleButton, OrDivider } from "../auth/google-button";
import { trackAuth, identifySession } from "@/lib/analytics";

const apiBase = "/api/proxy";

// ─── Step 1 — name + email ──────────────────────────────────────────────────

function DetailsStep({
  accountType,
  onNext,
  onBack,
  submitting,
  submitError,
}: {
  accountType: "startup" | "investor";
  onNext: (name: string, email: string) => void;
  onBack: () => void;
  submitting?: boolean;
  submitError?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailMode, setEmailMode] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // First click reveals the email field; the next one sends the code.
    if (!emailMode) {
      setEmailMode(true);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    onNext(name.trim(), email.trim());
  }

  const label = accountType === "startup" ? "Startup name" : "Fund name";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-text" aria-label="Go back" disabled={submitting}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-text-muted">
          {accountType === "startup" ? "Startup account" : "Investor account"} — step 1 of 2
        </span>
      </div>

      {submitError && <p className="text-xs text-danger">{submitError}</p>}

      <div className="flex flex-col gap-1 px-4">
        <label htmlFor="rc-name" className="text-xs font-medium text-text-muted">{label} <span className="text-danger">*</span></label>
        <input id="rc-name" type="text" placeholder="Acme Inc" value={name}
          onChange={(e) => { setName(e.target.value); setNameError(""); }}
          required minLength={2} maxLength={100} disabled={submitting} autoFocus className="input" />
        {nameError && <p className="text-xs text-danger">{nameError}</p>}
      </div>

      <fieldset
        disabled={submitting || name.trim().length < 2}
        className="flex flex-col gap-3 rounded-xl border border-border p-4 transition disabled:opacity-50"
      >
        {emailMode && (
          <div className="flex flex-col gap-1">
            <label htmlFor="rc-email" className="text-xs font-medium text-text-muted">Email <span className="text-danger">*</span></label>
            <input id="rc-email" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
              required autoComplete="email" autoFocus className="input" />
            {emailError && <p className="text-xs text-danger">{emailError}</p>}
          </div>
        )}

        <Button type="submit" className="w-full">
          {!emailMode
            ? "Continue with email"
            : submitting
              ? "Sending code…"
              : "Send code"}
        </Button>

        {accountType === "startup" && (
          <>
            <OrDivider />
            <GoogleButton intent={{ account_type: "startup", name: name.trim() }} />
          </>
        )}
      </fieldset>
    </form>
  );
}

// ─── Step 2 — OTP ─────────────────────────────────────────────────────────────

function OtpStep({
  email,
  accountType,
  onSuccess,
}: {
  email: string;
  accountType: "startup" | "investor";
  onSuccess: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useNextRouter();
  const submitted = useRef(false);

  async function verify(c: string) {
    if (submitted.current) return;
    submitted.current = true;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: c }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Verification failed. Please try again.");
      }
      trackAuth("register", { accountType, success: true });
      identifySession(email);
      window.location.reload();
      onSuccess();
      router.push(accountType === "startup" ? "/startups" : "/investors");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      submitted.current = false;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium text-text-muted">
        {accountType === "startup" ? "Startup account" : "Investor account"} — step 2 of 2
      </span>
      <p className="text-center text-sm text-text-muted">
        A 6-digit code was sent to <span className="font-medium text-text">{email}</span>
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor="rc-otp" className="text-xs font-medium text-text-muted">6-digit code</label>
        <input id="rc-otp" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
          placeholder="123456" value={code}
          onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) verify(v); }}
          autoComplete="one-time-code" autoFocus className="input tracking-widest text-center" />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="button" onClick={() => verify(code)} disabled={loading || code.length !== 6} className="w-full">
        {loading ? "Verifying…" : "Verify & create account"}
      </Button>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────

export default function RegisterCompanyForm({
  accountType,
  onBack,
  onSuccess,
}: {
  accountType: "startup" | "investor";
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [pending, setPending] = useState<{ email: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function submit(startupName: string, email: string) {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_type: accountType,
          name: startupName,
          email,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        if (res.status === 409) throw new Error("Email already registered.");
        throw new Error(body.message ?? "Failed to submit. Please try again.");
      }
      setPending({ email });
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pending) {
    return <OtpStep email={pending.email} accountType={accountType} onSuccess={onSuccess} />;
  }

  return (
    <DetailsStep
      accountType={accountType}
      submitting={submitting}
      submitError={submitError}
      onNext={(n, e) => submit(n, e)}
      onBack={onBack}
    />
  );
}
