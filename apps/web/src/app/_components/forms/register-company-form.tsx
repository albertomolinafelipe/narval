"use client";

import { useState, useRef } from "react";
import { useRouter as useNextRouter } from "next/navigation";
import { ChevronLeft, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackAuth, identifySession } from "@/lib/analytics";

const apiBase = "/api/proxy";

function extractDomain(url: string): string {
  try {
    if (!url.includes("://")) url = "https://" + url;
    const host = new URL(url).hostname;
    return host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isValidDomain(raw: string): boolean {
  const host = extractDomain(raw.trim());
  if (!host) return false;
  const parts = host.split(".");
  return parts.length >= 2 && parts.every((p) => p.length > 0);
}

// ─── Path selection ────────────────────────────────────────────────────────

function PathStep({
  onSelect,
  onBack,
}: {
  onSelect: (path: "verified" | "open") => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-text" aria-label="Go back">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-text-muted">Startup account</span>
      </div>

      <p className="text-sm text-text-muted">Does your startup have a website?</p>

      <button
        type="button"
        onClick={() => onSelect("verified")}
        className="flex flex-col gap-0.5 rounded-xl border border-border bg-bg-subtle px-4 py-3 text-left transition hover:border-brand hover:bg-bg-raised"
      >
        <span className="flex items-center gap-1.5 text-sm font-medium text-text">
          <BadgeCheck size={15} className="text-brand" />
          Yes, I have a domain
        </span>
        <span className="text-xs text-text-muted">
          Register with your work email — your profile will show a verified badge.
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSelect("open")}
        className="flex flex-col gap-0.5 rounded-xl border border-border bg-bg-subtle px-4 py-3 text-left transition hover:border-brand hover:bg-bg-raised"
      >
        <span className="text-sm font-medium text-text">Not yet, I&apos;m early stage</span>
        <span className="text-xs text-text-muted">
          Register with any email. We may reach out to verify your account. You can also verify your domain later.
        </span>
      </button>
    </div>
  );
}

// ─── Verified path: Step 1 — name + website ────────────────────────────────

interface VerifiedStep1Data { name: string; website: string }

function VerifiedStep1({
  onNext,
  onBack,
}: {
  onNext: (data: VerifiedStep1Data) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [websiteStatus, setWebsiteStatus] = useState<"idle" | "checking" | "taken" | "ok">("idle");
  const [nameError, setNameError] = useState("");
  const [websiteError, setWebsiteError] = useState("");

  async function checkWebsite(url: string) {
    if (!url) return;
    if (!isValidDomain(url)) {
      setWebsiteError("Enter a valid domain, e.g. acme.com");
      setWebsiteStatus("idle");
      return;
    }
    setWebsiteError("");
    setWebsiteStatus("checking");
    try {
      const res = await fetch(`${apiBase}/startups/check-website?url=${encodeURIComponent(url)}`);
      if (!res.ok) { setWebsiteStatus("idle"); return; }
      const body = (await res.json()) as { available: boolean; reason?: string };
      if (!body.available && body.reason === "subdomain") {
        setWebsiteError("Use your root domain (e.g. example.com, not app.example.com).");
        setWebsiteStatus("taken");
      } else {
        setWebsiteStatus(body.available ? "ok" : "taken");
      }
    } catch {
      setWebsiteStatus("idle");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError("Name is required."); return; }
    if (name.trim().length < 2) { setNameError("Name must be at least 2 characters."); return; }
    if (!website.trim()) { setWebsiteError("Website is required."); return; }
    if (!isValidDomain(website)) { setWebsiteError("Enter a valid domain, e.g. acme.com"); return; }
    if (websiteStatus === "idle" || websiteStatus === "checking") {
      await checkWebsite(website);
      return;
    }
    if (websiteStatus === "taken") return;
    onNext({ name: name.trim(), website: website.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-text" aria-label="Go back">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-text-muted">Verified account — step 1 of 3</span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="rs-name" className="text-xs font-medium text-text-muted">Startup name <span className="text-danger">*</span></label>
        <input id="rs-name" type="text" placeholder="Acme Inc" value={name}
          onChange={(e) => { setName(e.target.value); setNameError(""); }}
          required minLength={2} maxLength={100} className="input" />
        {nameError && <p className="text-xs text-danger">{nameError}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="rs-website" className="text-xs font-medium text-text-muted">Website <span className="text-danger">*</span></label>
        <input id="rs-website" type="text" placeholder="acme.com" value={website}
          onChange={(e) => { setWebsite(e.target.value); setWebsiteStatus("idle"); setWebsiteError(""); }}
          onBlur={() => checkWebsite(website)} className="input" />
        {websiteError && <p className="text-xs text-danger">{websiteError}</p>}
        {!websiteError && websiteStatus === "checking" && <p className="text-xs text-text-muted">Checking…</p>}
        {!websiteError && websiteStatus === "taken" && <p className="text-xs text-danger">This domain is already registered.</p>}
        {!websiteError && websiteStatus === "ok" && <p className="text-xs text-brand">Domain available.</p>}
      </div>

      <Button type="submit" disabled={websiteStatus === "taken" || !!websiteError} className="w-full">
        Continue
      </Button>
    </form>
  );
}

// ─── Verified path: Step 2 — work email prefix ────────────────────────────

function VerifiedStep2({
  website,
  onNext,
  onBack,
  submitting,
}: {
  website: string;
  onNext: (emailPrefix: string) => void;
  onBack: () => void;
  submitting?: boolean;
}) {
  const domain = extractDomain(website) || "yourdomain.com";
  const [emailPrefix, setEmailPrefix] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = emailPrefix.trim();
    if (!clean) { setError("Enter the local part of your work email."); return; }
    if (!/^[^\s@]+$/.test(clean)) { setError("Must not contain @ or spaces."); return; }
    onNext(clean);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-text" aria-label="Go back" disabled={submitting}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-text-muted">Verified account — step 2 of 3</span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="rs-email-prefix" className="text-xs font-medium text-text-muted">Work email <span className="text-danger">*</span></label>
        <div className="flex items-center overflow-hidden rounded-lg border border-border bg-bg-subtle focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
          <input id="rs-email-prefix" type="text" placeholder="you" value={emailPrefix}
            onChange={(e) => { setEmailPrefix(e.target.value.replace(/[@\s]/g, "")); setError(""); }}
            required autoComplete="username" disabled={submitting}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-text outline-none" />
          <span className="max-w-[60%] truncate border-l border-border bg-bg-raised px-3 py-2 text-sm text-text-muted select-none">
            @{domain}
          </span>
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Sending code…" : "Continue"}
      </Button>
    </form>
  );
}

// ─── Open path: Step 1 — name + any email ─────────────────────────────────

function OpenStep1({
  onNext,
  onBack,
  submitting,
}: {
  onNext: (name: string, email: string) => void;
  onBack: () => void;
  submitting?: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) { setNameError("Name must be at least 2 characters."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError("Enter a valid email address."); return; }
    onNext(name.trim(), email.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="text-xs text-text-muted hover:text-text" aria-label="Go back" disabled={submitting}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-text-muted">Early stage account — step 1 of 2</span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="os-name" className="text-xs font-medium text-text-muted">Startup name <span className="text-danger">*</span></label>
        <input id="os-name" type="text" placeholder="Acme Inc" value={name}
          onChange={(e) => { setName(e.target.value); setNameError(""); }}
          required minLength={2} maxLength={100} disabled={submitting} className="input" />
        {nameError && <p className="text-xs text-danger">{nameError}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="os-email" className="text-xs font-medium text-text-muted">Email <span className="text-danger">*</span></label>
        <input id="os-email" type="email" placeholder="you@example.com" value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
          required autoComplete="email" disabled={submitting} className="input" />
        {emailError && <p className="text-xs text-danger">{emailError}</p>}
      </div>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Sending code…" : "Continue"}
      </Button>
    </form>
  );
}

// ─── Shared: OTP step ──────────────────────────────────────────────────────

function OtpStep({
  email,
  accountType,
  stepLabel,
  onSuccess,
}: {
  email: string;
  accountType: "startup" | "investor";
  stepLabel: string;
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
      <span className="text-xs font-medium text-text-muted">{stepLabel}</span>
      <p className="text-center text-sm text-text-muted">
        A 6-digit code was sent to <span className="font-medium text-text">{email}</span>
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor="rs-otp" className="text-xs font-medium text-text-muted">6-digit code</label>
        <input id="rs-otp" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
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
  const [path, setPath] = useState<"verified" | "open" | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState<{ email: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function submitVerified(emailPrefix: string) {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_type: accountType,
          name,
          website,
          email_prefix: emailPrefix,
          verified: true,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
        if (body.code === "SUBDOMAIN_NOT_ALLOWED") throw new Error("Please use your root domain (e.g. example.com, not app.example.com).");
        if (body.code === "PUBLIC_DOMAIN") throw new Error("That's a personal email provider. Use your company domain.");
        if (res.status === 409) throw new Error(body.message ?? "Domain or email already registered.");
        throw new Error(body.message ?? "Failed to submit. Please try again.");
      }
      const domain = extractDomain(website);
      setPending({ email: `${emailPrefix}@${domain}` });
      setStep(3);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOpen(startupName: string, email: string) {
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
          verified: false,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        if (res.status === 409) throw new Error("Email already registered.");
        throw new Error(body.message ?? "Failed to submit. Please try again.");
      }
      setPending({ email });
      setStep(3);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  // Path selection
  if (!path) {
    return <PathStep onSelect={(p) => { setPath(p); setStep(1); }} onBack={onBack} />;
  }

  // Verified flow
  if (path === "verified") {
    if (step === 1) {
      return (
        <VerifiedStep1
          onNext={(data) => { setName(data.name); setWebsite(data.website); setStep(2); }}
          onBack={() => setPath(null)}
        />
      );
    }
    if (step === 2) {
      return (
        <>
          {submitError && <p className="mb-2 text-xs text-danger">{submitError}</p>}
          <VerifiedStep2
            website={website}
            submitting={submitting}
            onNext={submitVerified}
            onBack={() => setStep(1)}
          />
        </>
      );
    }
  }

  // Open flow
  if (path === "open") {
    if (step === 1) {
      return (
        <>
          {submitError && <p className="mb-2 text-xs text-danger">{submitError}</p>}
          <OpenStep1
            submitting={submitting}
            onNext={(n, e) => { setName(n); submitOpen(n, e); }}
            onBack={() => setPath(null)}
          />
        </>
      );
    }
  }

  // OTP step (both paths)
  if (step === 3 && pending) {
    return (
      <OtpStep
        email={pending.email}
        accountType={accountType}
        stepLabel={path === "verified" ? "Verified account — step 3 of 3" : "Early stage account — step 2 of 2"}
        onSuccess={onSuccess}
      />
    );
  }

  return null;
}
