"use client";

import { useState, useRef } from "react";
import { useRouter as useNextRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { trackAuth, identifySession } from "@/lib/analytics";

const apiBase = "/api/proxy";

//  Helpers

function extractDomain(url: string): string {
  try {
    if (!url.includes("://")) url = "https://" + url;
    const host = new URL(url).hostname;
    return host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Returns true if the input looks like a valid domain (e.g. "acme.com").
// Accepts bare hostnames and full URLs with a scheme.
function isValidDomain(raw: string): boolean {
  const host = extractDomain(raw.trim());
  if (!host) return false;
  const parts = host.split(".");
  return parts.length >= 2 && parts.every((p) => p.length > 0);
}

//  Step 1: Name + website

interface Step1Data {
  name: string;
  website: string;
}

function Step1({
  onNext,
  onBack,
}: {
  onNext: (data: Step1Data) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [websiteStatus, setWebsiteStatus] = useState<
    "idle" | "checking" | "taken" | "ok"
  >("idle");
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
      const res = await fetch(
        `${apiBase}/startups/check-website?url=${encodeURIComponent(url)}`,
      );
      if (!res.ok) {
        setWebsiteStatus("idle");
        return;
      }
      const body = (await res.json()) as { available: boolean };
      setWebsiteStatus(body.available ? "ok" : "taken");
    } catch {
      setWebsiteStatus("idle");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Name is required.");
      return;
    }
    if (name.trim().length < 2) {
      setNameError("Name must be at least 2 characters.");
      return;
    }
    if (!website.trim()) {
      setWebsiteError("Website is required.");
      return;
    }
    if (!isValidDomain(website)) {
      setWebsiteError("Enter a valid domain, e.g. acme.com");
      return;
    }
    if (websiteStatus === "taken") return;
    onNext({ name: name.trim(), website: website.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          Company account — step 1 of 3
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="rs-name"
          className="text-xs font-medium text-text-muted"
        >
          Startup name <span className="text-danger">*</span>
        </label>
        <input
          id="rs-name"
          type="text"
          placeholder="Acme Inc"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError("");
          }}
          required
          minLength={2}
          maxLength={100}
          className="input"
        />
        {nameError && <p className="text-xs text-danger">{nameError}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="rs-website"
          className="text-xs font-medium text-text-muted"
        >
          Website <span className="text-danger">*</span>
        </label>
        <input
          id="rs-website"
          type="text"
          placeholder="acme.com"
          value={website}
          onChange={(e) => {
            setWebsite(e.target.value);
            setWebsiteStatus("idle");
            setWebsiteError("");
          }}
          onBlur={() => checkWebsite(website)}
          className="input"
        />
        {websiteError && <p className="text-xs text-danger">{websiteError}</p>}
        {!websiteError && websiteStatus === "checking" && (
          <p className="text-xs text-text-muted">Checking…</p>
        )}
        {!websiteError && websiteStatus === "taken" && (
          <p className="text-xs text-danger">
            This website is already registered.
          </p>
        )}
        {!websiteError && websiteStatus === "ok" && (
          <p className="text-xs text-brand">Website available.</p>
        )}
      </div>

      <button
        type="submit"
        disabled={websiteStatus === "taken" || !!websiteError}
        className="btn-primary w-full"
      >
        Continue
      </button>
    </form>
  );
}

//  Step 2: Email only

interface Step2Data {
  emailPrefix: string;
}

function Step2({
  website,
  onNext,
  onBack,
  submitting,
}: {
  website: string;
  onNext: (data: Step2Data) => void;
  onBack: () => void;
  submitting?: boolean;
}) {
  const domain = extractDomain(website) || "yourdomain.com";
  const [emailPrefix, setEmailPrefix] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanPrefix = emailPrefix.trim();
    if (!cleanPrefix) {
      setError("Enter the local part of your work email.");
      return;
    }
    if (!/^[^\s@]+$/.test(cleanPrefix)) {
      setError("Email must not contain @ or spaces.");
      return;
    }
    onNext({
      emailPrefix: cleanPrefix,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-text-muted hover:text-text"
          aria-label="Go back"
          disabled={submitting}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-text-muted">
          Company account — step 2 of 3
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="rs-email-prefix"
          className="text-xs font-medium text-text-muted"
        >
          Work email <span className="text-danger">*</span>
        </label>
        <div className="flex items-center rounded-lg border border-border bg-bg-subtle focus-within:border-brand focus-within:ring-1 focus-within:ring-brand overflow-hidden">
          <input
            id="rs-email-prefix"
            type="text"
            placeholder="you"
            value={emailPrefix}
            onChange={(e) => {
              setEmailPrefix(e.target.value.replace(/[@\s]/g, ""));
              setError("");
            }}
            required
            autoComplete="username"
            disabled={submitting}
            className="flex-1 bg-transparent px-3 py-2 text-sm text-text outline-none min-w-0"
          />
          <span className="select-none bg-bg-raised px-3 py-2 text-sm text-text-muted border-l border-border max-w-[60%] truncate">
            @{domain}
          </span>
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? "Sending code…" : "Continue"}
      </button>
    </form>
  );
}

//  Step 3: OTP verify

function Step4({
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
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(
          body.message ?? "Verification failed. Please try again.",
        );
      }

      // Track successful registration and identify session
      trackAuth("register", {
        accountType,
        success: true,
      });

      identifySession(email);

      // SuperTokens creates session automatically via cookies
      // Reload to update UI with new session
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

  function handleChange(val: string) {
    const clean = val.replace(/\D/g, "").slice(0, 6);
    setCode(clean);
    if (clean.length === 6) verify(clean);
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium text-text-muted">
        Company account — step 3 of 3
      </span>

      <p className="text-center text-sm text-text-muted">
        A 6-digit code was sent to{" "}
        <span className="font-medium text-text">{email}</span>
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="rs-otp" className="text-xs font-medium text-text-muted">
          6-digit code
        </label>
        <input
          id="rs-otp"
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

      <button
        type="button"
        onClick={() => verify(code)}
        disabled={loading || code.length !== 6}
        className="btn-primary w-full"
      >
        {loading ? "Verifying…" : "Verify & create account"}
      </button>
    </div>
  );
}

//  Root export

interface DraftState {
  name: string;
  website: string;
}

export default function RegisterCompanyForm({
  accountType,
  onBack,
  onSuccess,
}: {
  accountType: "startup" | "investor";
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Partial<DraftState>>({});
  const [pending, setPending] = useState<{
    email: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const accountLabel = accountType === "startup" ? "Startup" : "Investor";

  async function submitDraft(emailPrefix: string, d: DraftState) {
    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_type: accountType,
          name: d.name,
          website: d.website,
          email_prefix: emailPrefix,
          nickname: d.name,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        if (res.status === 409)
          throw new Error(
            body.message ?? "Email or website already registered.",
          );
        throw new Error(body.message ?? "Failed to submit. Please try again.");
      }

      const result = (await res.json()) as { email?: string; message?: string };
      // Construct the full email from prefix and domain
      const domain = extractDomain(d.website);
      const fullEmail = `${emailPrefix}@${domain}`;
      
      setPending({ email: fullEmail });
      setStep(3);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 1) {
    return (
      <Step1
        onNext={(data) => {
          setDraft((d) => ({ ...d, ...data }));
          setStep(2);
        }}
        onBack={onBack}
      />
    );
  }

  if (step === 2) {
    return (
      <>
        {submitError && (
          <p className="mb-2 text-xs text-danger">{submitError}</p>
        )}
        <Step2
          website={draft.website ?? ""}
          submitting={submitting}
          onNext={(data) => {
            if (submitting) return;
            const merged = { ...draft, ...data };
            setDraft(merged);
            submitDraft(data.emailPrefix, merged as DraftState);
          }}
          onBack={() => setStep(1)}
        />
      </>
    );
  }

  if (step === 3 && pending) {
    return (
      <Step4
        email={pending.email}
        accountType={accountType}
        onSuccess={onSuccess}
      />
    );
  }

  return null;
}
