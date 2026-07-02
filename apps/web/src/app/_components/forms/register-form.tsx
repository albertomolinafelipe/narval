"use client";

import { useState, useRef } from "react";
import { ChevronLeft, User } from "lucide-react";
import { GiUnicorn } from "react-icons/gi";
import RegisterCompanyForm from "./register-company-form";
import { Button } from "@/components/ui/button";
import { GoogleButton, OrDivider } from "../auth/google-button";
import { trackAuth, identifySession } from "@/lib/analytics";

type AccountType = "user" | "startup";

const apiBase = "/api/proxy";

// Step 1 — pick account type
function TypeStep({ onSelect }: { onSelect: (type: AccountType) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-sm text-text-muted">
        What kind of account do you want to create?
      </p>
      <button
        type="button"
        onClick={() => onSelect("user")}
        className="flex flex-col gap-0.5 rounded-xl border border-border bg-bg-subtle px-4 py-3 text-left transition hover:border-brand hover:bg-bg-raised"
        data-umami-event="register-account-type"
        data-umami-event-type="user"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-text"><User size={15} /> User</span>
        <span className="text-xs text-text-muted">
          Browse and discover startups on the platform.
        </span>
      </button>
      <button
        type="button"
        onClick={() => onSelect("startup")}
        className="flex flex-col gap-0.5 rounded-xl border border-border bg-bg-subtle px-4 py-3 text-left transition hover:border-brand hover:bg-bg-raised"
        data-umami-event="register-account-type"
        data-umami-event-type="startup"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-text"><GiUnicorn size={15} /> Startup</span>
        <span className="text-xs text-text-muted">
          Create a startup profile and get discovered.
        </span>
      </button>
    </div>
  );
}

// Step 2 (user only) — fill in basic details and send OTP
function UserDetailsStep({
  onBack,
  onCodeSent,
}: {
  onBack: () => void;
  onCodeSent: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          nickname,
          account_type: "user",
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        if (res.status === 409)
          throw new Error("This email is already registered.");
        throw new Error(
          body.message ?? "Registration failed. Please try again.",
        );
      }

      trackAuth("register_code_sent", { success: true, account_type: "user" });
      onCodeSent(email);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      trackAuth("register_code_sent", { success: false, error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-text-muted hover:text-text"
          aria-label="Go back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-text-muted">
          User account
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="reg-nickname"
          className="text-xs font-medium text-text-muted"
        >
          Nickname <span className="text-danger">*</span>
        </label>
        <input
          id="reg-nickname"
          type="text"
          placeholder="yourname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          minLength={2}
          maxLength={50}
          autoFocus
          className="input"
        />
      </div>

      <fieldset
        disabled={loading || nickname.trim().length < 2}
        className="flex flex-col gap-3 rounded-xl border border-border p-4 transition disabled:opacity-50"
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="reg-email"
            className="text-xs font-medium text-text-muted"
          >
            Email <span className="text-danger">*</span>
          </label>
          <input
            id="reg-email"
            type="text"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="input"
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <Button type="submit" className="w-full">
          {loading ? "Sending code…" : "Continue with email"}
        </Button>

        <OrDivider />
        <GoogleButton intent={{ account_type: "user", name: nickname.trim() }} />
      </fieldset>
    </form>
  );
}

// Step 3 (user only) — 6-digit OTP, auto-submits on 6 digits
function UserVerifyStep({
  email,
  onSuccess,
}: {
  email: string;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        if (res.status === 400)
          throw new Error(body.message ?? "Invalid or expired code.");
        if (res.status === 409)
          throw new Error("This email is already registered.");
        throw new Error(
          body.message ?? "Verification failed. Please try again.",
        );
      }

      trackAuth("register", { success: true, account_type: "user" });
      identifySession(email);

      // SuperTokens creates session automatically via cookies
      // Reload to update UI with new session
      window.location.reload();
      onSuccess();
    } catch (err: unknown) {
      submitted.current = false;
      setLoading(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      trackAuth("register", { success: false, error: String(err) });
    }
  }

  function handleChange(val: string) {
    const clean = val.replace(/\D/g, "").slice(0, 6);
    setCode(clean);
    if (clean.length === 6) verify(clean);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-sm text-text-muted">
        A verification code was sent to{" "}
        <span className="font-medium text-text">{email}</span>
      </p>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="reg-code"
          className="text-xs font-medium text-text-muted"
        >
          6-digit code
        </label>
        <input
          id="reg-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => handleChange(e.target.value)}
          autoComplete="one-time-code"
          autoFocus
          className="input tracking-widest text-center"
        />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button
        type="button"
        onClick={() => verify(code)}
        disabled={loading || code.length !== 6}
        className="w-full"
      >
        {loading ? "Verifying…" : "Verify & create account"}
      </Button>
    </div>
  );
}

// Root export — orchestrates all flows
export default function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  if (accountType === null) {
    return <TypeStep onSelect={setAccountType} />;
  }

  // Startup wizard — fully self-contained
  if (accountType === "startup") {
    return (
      <RegisterCompanyForm
        accountType="startup"
        onBack={() => setAccountType(null)}
        onSuccess={onSuccess}
      />
    );
  }

  // User flow — simple 2-step
  if (pendingEmail === null) {
    return (
      <UserDetailsStep
        onBack={() => setAccountType(null)}
        onCodeSent={(email) => setPendingEmail(email)}
      />
    );
  }

  return (
    <UserVerifyStep
      email={pendingEmail}
      onSuccess={onSuccess}
    />
  );
}
