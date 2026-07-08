"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, Copy, ExternalLink } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { InstagramGradientIcon } from "@/app/_components/shared/instagram-icon";
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
import { getInstagramVerificationQueryKey } from "@/lib/api/gen/@tanstack/react-query.gen";
import type { InstagramVerification } from "@/lib/api/gen";

// The company account startups DM their code to. ig.me/m opens a DM directly.
const COMPANY_HANDLE = "gonarval";
const COMPANY_DM_URL = `https://ig.me/m/${COMPANY_HANDLE}`;

// The Instagram glyph. With gradient=true it wears Instagram's brand ramp; with
// gradient=false it inherits the button's text color (used for the verified /
// pending states, which recolor the same icon rather than swapping it out).
function InstagramIcon({
  size = 16,
  gradient = true,
}: {
  size?: number;
  gradient?: boolean;
}) {
  if (!gradient) return <SiInstagram size={size} />;
  return <InstagramGradientIcon size={size} />;
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
        setError(
          "A verification is already in progress. Ask an admin to reset it.",
        );
      else
        setError(
          (error as { message?: string })?.message ??
            "Failed to start verification.",
        );
      return;
    }
    onStarted(data);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="vi-handle"
          className="text-xs font-medium text-text-muted"
        >
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
          The handle locks once you continue — only an admin can change it
          later.
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

function InstructionsStep({
  verification,
}: {
  verification: InstagramVerification;
}) {
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
          1. From{" "}
          <span className="font-medium text-text">@{verification.handle}</span>,
          open a DM to{" "}
          <span className="font-medium text-text">@{COMPANY_HANDLE}</span> on
          Instagram.
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
          {copied ? (
            <Check size={14} className="text-success" />
          ) : (
            <Copy size={14} />
          )}
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
        We&apos;ll add your verified badge once we receive and match your DM.
        You can close this — nothing else to do on your end.
      </p>
    </div>
  );
}

// ─── Verified panel (shown when already verified) ────────────────────────────

function VerifiedStep({ handle }: { handle: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
        <BadgeCheck size={18} className="shrink-0" />
        <span>
          <span className="font-medium">@{handle}</span> is verified.
        </span>
      </div>
      <p className="text-xs text-text-muted">
        Editing your Instagram handle removes this verification. Ask an admin to
        reset it if you need to change it.
      </p>
    </div>
  );
}

// ─── Modal body ──────────────────────────────────────────────────────────────

type Step =
  | { name: "verified"; handle: string }
  | { name: "handle" }
  | { name: "instructions"; verification: InstagramVerification };

// Rendered only while the dialog is open (radix unmounts content on close), so
// its step is freshly seeded from the current state on every open.
function ModalBody({
  startupId,
  verified,
  verification,
  defaultHandle,
  onStarted,
}: {
  startupId: string;
  verified: boolean;
  verification: InstagramVerification | null | undefined;
  defaultHandle?: string;
  onStarted: (v: InstagramVerification) => void;
}) {
  const [step, setStep] = useState<Step>(
    verified
      ? { name: "verified", handle: defaultHandle ?? "" }
      : verification?.status === "pending"
        ? { name: "instructions", verification }
        : { name: "handle" },
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Verify your Instagram</DialogTitle>
        <DialogDescription>
          {step.name === "handle" &&
            "Confirm the handle you control to earn a verified badge."}
          {step.name === "instructions" &&
            "DM us the code to finish verifying."}
          {step.name === "verified" && "Your Instagram handle is verified."}
        </DialogDescription>
      </DialogHeader>

      {step.name === "handle" && (
        <HandleStep
          startupId={startupId}
          defaultHandle={defaultHandle}
          onStarted={(v) => {
            setStep({ name: "instructions", verification: v });
            onStarted(v);
          }}
        />
      )}
      {step.name === "instructions" && (
        <InstructionsStep verification={step.verification} />
      )}
      {step.name === "verified" && <VerifiedStep handle={step.handle} />}
    </>
  );
}

// ─── Trigger + modal ─────────────────────────────────────────────────────────

export function VerifyInstagramButton({
  startupId,
  verified,
  defaultHandle,
}: {
  startupId: string;
  verified: boolean;
  defaultHandle?: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Owner-side lookup of the current challenge, shared by cache. Only needed
  // while unverified — a verified startup's state is already known.
  const { data: verification } = useQuery({
    queryKey: getInstagramVerificationQueryKey({ path: { id: startupId } }),
    enabled: !verified,
    retry: false,
    queryFn: async () => {
      const { data } = await getInstagramVerification({
        path: { id: startupId },
      });
      return data ?? null;
    },
  });

  const pending = !verified && verification?.status === "pending";

  const trigger = verified
    ? {
        className:
          "border-success/40 text-success hover:bg-success/10 hover:text-success",
        icon: <InstagramIcon size={16} gradient={false} />,
        label: "Verified",
      }
    : pending
      ? {
          className: "text-text-muted",
          icon: <InstagramIcon size={16} gradient={false} />,
          label: "Pending",
        }
      : {
          className: "",
          icon: <InstagramIcon size={16} />,
          label: "Verify Instagram",
        };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={trigger.className}
        onClick={() => setOpen(true)}
      >
        {trigger.icon}
        {trigger.label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <ModalBody
            startupId={startupId}
            verified={verified}
            verification={verification}
            defaultHandle={defaultHandle}
            onStarted={() =>
              // Refresh the shared query so the trigger flips to pending.
              queryClient.invalidateQueries({
                queryKey: getInstagramVerificationQueryKey({
                  path: { id: startupId },
                }),
              })
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
