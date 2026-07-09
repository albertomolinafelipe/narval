"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { getClaimLink } from "@/lib/api/gen";

// Shown on the edit page while a shell is unclaimed and viewed by its owner (the
// admin who seeded it). Surfaces the two links the admin saves in their own doc:
// the claim link to send the startup, and the edit link to come back later. The
// claim-link endpoint is owner-only, so this quietly renders nothing for anyone
// else or once the profile is claimed.
export default function ClaimBanner({ id }: { id: string }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getClaimLink({ path: { id } })
      .then(({ data }) => {
        if (active && data && !data.claimed && data.claim_token)
          setToken(data.claim_token);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);

  if (!token) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const claimUrl = `${origin}/claim/${token}`;
  const editUrl = `${origin}/startups/in/${id}/edit`;

  return (
    <div className="mx-auto mt-4 max-w-5xl rounded-xl border border-[var(--color-wip-text)] bg-[var(--color-wip-text)]/10 px-4 py-3">
      <p className="text-sm font-medium text-text">Unclaimed profile</p>
      <p className="mt-0.5 text-xs text-text-muted">
        Save both links. Send the claim link to the startup; keep the edit link
        to return here. You lose edit access the moment they claim it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton
          label="Copy claim link"
          icon={<Link2 className="h-4 w-4" />}
          value={claimUrl}
        />
        <CopyButton
          label="Copy edit link"
          icon={<Copy className="h-4 w-4" />}
          value={editUrl}
        />
      </div>
    </div>
  );
}

function CopyButton({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-2 rounded-lg border border-[var(--color-wip-text)] bg-[var(--color-wip-text)]/10 px-3 py-1.5 text-sm text-text transition hover:bg-[var(--color-wip-text)]/20"
    >
      {copied ? <Check className="h-4 w-4 text-brand" /> : icon}
      {copied ? "Copied" : label}
    </button>
  );
}
