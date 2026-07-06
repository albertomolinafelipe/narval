"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getInstagramVerification,
  startInstagramVerification,
} from "@/lib/api/gen";
import type { InstagramVerification } from "@/lib/api/gen";

// The company account startups DM their code to. ig.me/m opens a DM directly.
const COMPANY_HANDLE = "gonarval";
const COMPANY_DM_URL = `https://ig.me/m/${COMPANY_HANDLE}`;

// Instagram's brand gradient, applied to the glyph via an SVG fill so the icon
// reads as Instagram rather than a flat monochrome mark.
function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <>
      <svg width={0} height={0} className="absolute" aria-hidden>
        <linearGradient id="ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#feda75" />
          <stop offset="25%" stopColor="#fa7e1e" />
          <stop offset="50%" stopColor="#d62976" />
          <stop offset="75%" stopColor="#962fbf" />
          <stop offset="100%" stopColor="#4f5bd5" />
        </linearGradient>
      </svg>
      <SiInstagram size={size} style={{ fill: "url(#ig-gradient)" }} />
    </>
  );
}

// ─── Step 1 — handle ─────────────────────────────────────────────────────────

function HandleStep({
  startupId,
  defaultHandle,
  onStarted,
}: {
  startupId: string;
  defaultHandle?: string;
  onStarted: (v: InstagramVerification) => void;
}) {
  const [handle, setHandle] = useState(defaultHandle ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = handle.trim().replace(/^@/, "");
    if (!clean) {
      setError("Enter your Instagram handle.");
      return;
    }
    setSubmitting(true);
    setError("");
    const { data, error } = await startInstagramVerification({
      path: { id: startupId },
      body: { handle: clean },
    });
    setSubmitting(false);
    if (error || !data) {
      const code = (error as { code?: string })?.code;
      if (code === "INSTAGRAM_TAKEN")
        setError("This handle is already verified by another startup.");
      else if (code === "ALREADY_LOCKED")
        setError("A verification is already in progress. Ask an admin to reset it.");
      else setError((error as { message?: string })?.message ?? "Failed to start verification.");
      return;
    }
    onStarted(data);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="vi-handle" className="text-xs font-medium text-text-muted">
          Instagram handle <span className="text-danger">*</span>
        </label>
        <div className="flex items-center overflow-hidden rounded-lg border border-border bg-bg-subtle focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
          <span className="border-r border-border bg-bg-raised px-3 py-2 text-sm text-text-muted select-none">
            @
          </span>
          <input
            id="vi-handle"
            type="text"
            placeholder="yourbrand"
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value.replace(/^@/, ""));
              setError("");
            }}
            autoFocus
            disabled={submitting}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-text outline-none"
          />
        </div>
        <p className="text-xs text-text-muted">
          The handle locks once you continue — only an admin can change it later.
        </p>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Getting your code…" : "Continue"}
      </Button>
    </form>
  );
}

// ─── Step 2 — DM the code, then wait for an admin to confirm ──────────────────

function InstructionsStep({ verification }: { verification: InstagramVerification }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(verification.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the code is shown in full for manual copy */
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2 text-sm text-text-muted">
        <li>
          1. From <span className="font-medium text-text">@{verification.handle}</span>,
          open a DM to{" "}
          <span className="font-medium text-text">@{COMPANY_HANDLE}</span> on Instagram.
        </li>
        <li>2. Send this code as the message:</li>
      </ol>

      <button
        type="button"
        onClick={copy}
        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-subtle px-3 py-2.5 text-left transition hover:border-brand"
      >
        <span className="font-mono text-base font-semibold tracking-wider text-text">
          {verification.code}
        </span>
        <span className="flex items-center gap-1 text-xs text-text-muted">
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </span>
      </button>

      <Button asChild variant="outline" className="w-full">
        <a href={COMPANY_DM_URL} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} />
          Open Instagram DM
        </a>
      </Button>

      <p className="rounded-lg bg-bg-subtle px-3 py-2 text-xs text-text-muted">
        We&apos;ll add your verified badge once we receive and match your DM. You can
        close this — nothing else to do on your end.
      </p>
    </div>
  );
}

// ─── Trigger + modal ─────────────────────────────────────────────────────────

type Step =
  | { name: "loading" }
  | { name: "handle" }
  | { name: "instructions"; verification: InstagramVerification };

export function VerifyInstagramButton({
  startupId,
  defaultHandle,
}: {
  startupId: string;
  defaultHandle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ name: "loading" });
  const router = useRouter();

  // On open, resume an existing challenge if one is already in progress.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setStep({ name: "loading" });
    getInstagramVerification({ path: { id: startupId } }).then(({ data }) => {
      if (!active) return;
      setStep(data ? { name: "instructions", verification: data } : { name: "handle" });
    });
    return () => {
      active = false;
    };
  }, [open, startupId]);

  function onStarted(verification: InstagramVerification) {
    setStep({ name: "instructions", verification });
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <InstagramIcon size={16} />
        Verify Instagram
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify your Instagram</DialogTitle>
            <DialogDescription>
              {step.name === "handle" && "Confirm the handle you control to earn a verified badge."}
              {step.name === "instructions" && "DM us the code to finish verifying."}
              {step.name === "loading" && "Loading…"}
            </DialogDescription>
          </DialogHeader>

          {step.name === "handle" && (
            <HandleStep
              startupId={startupId}
              defaultHandle={defaultHandle}
              onStarted={onStarted}
            />
          )}
          {step.name === "instructions" && (
            <InstructionsStep verification={step.verification} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
