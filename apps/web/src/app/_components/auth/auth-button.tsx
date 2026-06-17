"use client";

import { useState } from "react";
import { signOut } from "supertokens-web-js/recipe/session";
import { useUser } from "@/lib/user";
import RegisterForm from "../forms/register-form";
import { trackAuth, identifySession } from "@/lib/analytics";

type View = "login" | "register";

export default function AuthButton({ onSuccess }: { onSuccess?: () => void }) {
  const { user, authenticated, loading } = useUser();
  const [view, setView] = useState<View>("login");

  //  Loading skeleton
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-9 animate-pulse rounded-lg bg-bg-subtle" />
        <div className="h-9 animate-pulse rounded-lg bg-bg-subtle" />
        <div className="h-9 animate-pulse rounded-lg bg-bg-subtle" />
      </div>
    );
  }

  //  Signed in
  if (authenticated && user) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-text-muted">
          Signed in as{" "}
          <span className="font-medium text-text">{user.email}</span>
        </p>
        <button
          onClick={async () => {
            trackAuth("logout");
            await signOut();
            window.location.reload(); // Reload to update UI
          }}
          className="btn-ghost w-full"
          data-umami-event="sign-out"
        >
          Sign out
        </button>
      </div>
    );
  }

  //  Tab bar
  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex rounded-lg bg-bg-subtle p-1">
        <TabButton
          active={view === "login"}
          onClick={() => setView("login")}
          data-umami-event="auth-tab-click"
          data-umami-event-tab="login"
        >
          Sign in
        </TabButton>
        <TabButton
          active={view === "register"}
          onClick={() => setView("register")}
          data-umami-event="auth-tab-click"
          data-umami-event-tab="register"
        >
          Register
        </TabButton>
      </div>

      {/* Panel */}
      {view === "login" ? (
        <LoginForm onSuccess={onSuccess} />
      ) : (
        <RegisterForm
          onSuccess={() => {
            setView("login");
            onSuccess?.();
          }}
        />
      )}
    </div>
  );
}

//  Login form with OTP
function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  async function handleSendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/proxy/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to send code");
      }

      setCodeSent(true);
      trackAuth("login_code_sent", { success: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      trackAuth("login_code_sent", { success: false, error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/proxy/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Invalid code");
      }

      trackAuth("login", { success: true });
      identifySession(email);
      
      // Reload to update session
      window.location.reload();
      onSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code.");
      trackAuth("login", { success: false, error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  if (!codeSent) {
    return (
      <form onSubmit={handleSendCode} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="auth-email"
            className="text-xs font-medium text-text-muted"
          >
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="input"
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
          data-umami-event="auth-submit"
          data-umami-event-type="login-send-code"
        >
          {loading ? "Sending code…" : "Send code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="auth-code"
          className="text-xs font-medium text-text-muted"
        >
          Verification code
        </label>
        <input
          id="auth-code"
          type="text"
          inputMode="numeric"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
          autoComplete="one-time-code"
          className="input text-center text-lg tracking-widest"
          maxLength={6}
        />
        <p className="text-xs text-text-muted">
          Enter the 6-digit code sent to {email}
        </p>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="btn-primary w-full"
        data-umami-event="auth-submit"
        data-umami-event-type="login-verify"
      >
        {loading ? "Verifying…" : "Verify code"}
      </button>
      <button
        type="button"
        onClick={() => {
          setCodeSent(false);
          setCode("");
          setError("");
        }}
        className="btn-ghost w-full text-xs"
      >
        Use different email
      </button>
    </form>
  );
}

//  Tab button
function TabButton({
  active,
  onClick,
  children,
  ...props
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-bg-raised text-text shadow-sm"
          : "text-text-muted hover:text-text"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
