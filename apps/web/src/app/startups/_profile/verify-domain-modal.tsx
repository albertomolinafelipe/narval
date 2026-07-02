"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { extractDomain, isValidDomain } from "@/lib/domain";
import {
  startDomainVerification,
  confirmDomainVerification,
} from "@/lib/api/client";

const apiBase = "/api/proxy";

// The wizard is a small discriminated state machine; each step carries exactly
// the data the next one needs. Add steps by extending this union.
type Step =
  | { name: "domain" }
  | { name: "email"; website: string }
  | { name: "code"; email: string };

// ─── Step 1 — domain + availability check ────────────────────────────────────

function DomainStep({
  defaultWebsite,
  onNext,
}: {
  defaultWebsite?: string;
  onNext: (website: string) => void;
}) {
  const [website, setWebsite] = useState(defaultWebsite ?? "");
  const [status, setStatus] = useState<"idle" | "checking" | "taken" | "ok">("idle");
  const [error, setError] = useState("");

  async function check(url: string): Promise<boolean> {
    if (!isValidDomain(url)) {
      setError("Enter a valid domain, e.g. acme.com");
      setStatus("idle");
      return false;
    }
    setError("");
    setStatus("checking");
    try {
      const res = await fetch(
        `${apiBase}/startups/check-website?url=${encodeURIComponent(url)}`,
      );
      if (!res.ok) {
        setStatus("idle");
        return false;
      }
      const body = (await res.json()) as { available: boolean; reason?: string };
      if (!body.available && body.reason === "subdomain") {
        setError("Use your root domain (e.g. example.com, not app.example.com).");
        setStatus("taken");
        return false;
      }
      setStatus(body.available ? "ok" : "taken");
      return body.available;
    } catch {
      setStatus("idle");
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!website.trim()) {
      setError("Enter your domain.");
      return;
    }
    // Re-check on submit unless we already have a confirmed-available result.
    const ok = status === "ok" ? true : await check(website);
    if (ok) onNext(website.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="vd-website" className="text-xs font-medium text-text-muted">
          Company domain <span className="text-danger">*</span>
        </label>
        <input
          id="vd-website"
          type="text"
          placeholder="acme.com"
          value={website}
          onChange={(e) => {
            setWebsite(e.target.value);
            setStatus("idle");
            setError("");
          }}
          onBlur={() => website.trim() && check(website)}
          autoFocus
          className="input"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        {!error && status === "checking" && (
          <p className="text-xs text-text-muted">Checking…</p>
        )}
        {!error && status === "taken" && (
          <p className="text-xs text-danger">This domain is already verified.</p>
        )}
        {!error && status === "ok" && (
          <p className="text-xs text-brand">Domain available.</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={status === "checking" || status === "taken" || !!error}
        className="w-full"
      >
        Continue
      </Button>
    </form>
  );
}

// ─── Step 2 — work email, sends the code ─────────────────────────────────────

function EmailStep({
  startupId,
  website,
  onSent,
}: {
  startupId: string;
  website: string;
  onSent: (email: string) => void;
}) {
  const domain = extractDomain(website) || website;
  const [prefix, setPrefix] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = prefix.trim();
    if (!clean || !/^[^\s@]+$/.test(clean)) {
      setError("Enter the part before @, no spaces.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { email } = await startDomainVerification(startupId, website, clean);
      onSent(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="vd-email" className="text-xs font-medium text-text-muted">
          Work email <span className="text-danger">*</span>
        </label>
        <div className="flex items-center overflow-hidden rounded-lg border border-border bg-bg-subtle focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
          <input
            id="vd-email"
            type="text"
            placeholder="you"
            value={prefix}
            onChange={(e) => {
              setPrefix(e.target.value.replace(/[@\s]/g, ""));
              setError("");
            }}
            autoComplete="username"
            autoFocus
            disabled={submitting}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-text outline-none"
          />
          <span className="max-w-[60%] truncate border-l border-border bg-bg-raised px-3 py-2 text-sm text-text-muted select-none">
            @{domain}
          </span>
        </div>
        <p className="text-xs text-text-muted">
          We&apos;ll email a code to this address to confirm you control the domain.
        </p>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Sending code…" : "Send code"}
      </Button>
    </form>
  );
}

// ─── Step 3 — code ────────────────────────────────────────────────────────────

function CodeStep({
  startupId,
  email,
  onVerified,
}: {
  startupId: string;
  email: string;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submitted = useRef(false);

  async function confirm(c: string) {
    if (submitted.current) return;
    submitted.current = true;
    setError("");
    setLoading(true);
    try {
      await confirmDomainVerification(startupId, c);
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      submitted.current = false;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-text-muted">
        A 6-digit code was sent to{" "}
        <span className="font-medium text-text">{email}</span>
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor="vd-code" className="text-xs font-medium text-text-muted">
          6-digit code
        </label>
        <input
          id="vd-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(v);
            if (v.length === 6) confirm(v);
          }}
          autoComplete="one-time-code"
          autoFocus
          className="input tracking-widest text-center"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button
        type="button"
        onClick={() => confirm(code)}
        disabled={loading || code.length !== 6}
        className="w-full"
      >
        {loading ? "Verifying…" : "Verify domain"}
      </Button>
    </div>
  );
}

// ─── Trigger + modal ─────────────────────────────────────────────────────────

export function VerifyDomainButton({
  startupId,
  defaultWebsite,
}: {
  startupId: string;
  defaultWebsite?: string;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ name: "domain" });
  const router = useRouter();

  function change(next: boolean) {
    setOpen(next);
    if (next) setStep({ name: "domain" }); // always restart the wizard on open
  }

  function onVerified() {
    setOpen(false);
    toast.success("Domain verified");
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => change(true)}>
        <BadgeCheck size={16} />
        Verify
      </Button>

      <Dialog open={open} onOpenChange={change}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify your domain</DialogTitle>
            <DialogDescription>
              {step.name === "domain" && "Confirm the domain you own to earn a verified badge."}
              {step.name === "email" && "Enter a work email at that domain."}
              {step.name === "code" && "Enter the code we emailed you."}
            </DialogDescription>
          </DialogHeader>

          {step.name === "domain" && (
            <DomainStep
              defaultWebsite={defaultWebsite}
              onNext={(website) => setStep({ name: "email", website })}
            />
          )}
          {step.name === "email" && (
            <EmailStep
              startupId={startupId}
              website={step.website}
              onSent={(email) => setStep({ name: "code", email })}
            />
          )}
          {step.name === "code" && (
            <CodeStep startupId={startupId} email={step.email} onVerified={onVerified} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
