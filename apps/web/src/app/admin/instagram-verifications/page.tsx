"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/lib/user";
import { Button } from "@/components/ui/button";
import {
  confirmInstagramVerificationMutation,
  listInstagramVerificationsOptions,
  resetInstagramVerificationMutation,
} from "@/lib/api/gen/@tanstack/react-query.gen";
import type { AdminInstagramVerification } from "@/lib/api/gen";

type Filter = "all" | "pending" | "verified";
const FILTERS: Filter[] = ["all", "pending", "verified"];

function invalidateList(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({
    predicate: (q) =>
      (q.queryKey[0] as { _id?: string })?._id === "listInstagramVerifications",
  });
}

function Row({ v }: { v: AdminInstagramVerification }) {
  const queryClient = useQueryClient();

  const confirm = useMutation({
    ...confirmInstagramVerificationMutation(),
    onSuccess: async () => {
      toast.success(`@${v.handle} verified`);
      await invalidateList(queryClient);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to confirm"),
  });

  const reset = useMutation({
    ...resetInstagramVerificationMutation(),
    onSuccess: async () => {
      toast.success("Verification reset");
      await invalidateList(queryClient);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to reset"),
  });

  const busy = confirm.isPending || reset.isPending;

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-3">
        <Link
          href={`/startups/in/${v.startup_id}`}
          className="text-sm font-medium text-text transition hover:text-brand"
        >
          {v.startup_name}
        </Link>
      </td>
      <td className="px-3 py-3">
        <a
          href={`https://instagram.com/${v.handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-text-muted transition hover:text-brand"
        >
          @{v.handle}
          <ExternalLink size={12} className="shrink-0" />
        </a>
      </td>
      <td className="px-3 py-3">
        <span className="font-mono text-sm text-text">{v.code}</span>
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            v.status === "verified"
              ? "bg-success/10 text-success"
              : "bg-[var(--color-wip-text)]/10 text-[var(--color-wip-text)]"
          }`}
        >
          {v.status}
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-text-subtle">
        {new Date(v.created_at).toLocaleDateString()}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-2">
          {v.status === "pending" && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => confirm.mutate({ path: { id: v.id } })}
            >
              <Check size={14} />
              Confirm
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  `Reset verification for @${v.handle}? This unlocks the handle and clears any verified badge.`,
                )
              )
                reset.mutate({ path: { id: v.id } });
            }}
          >
            <RotateCcw size={14} />
            Reset
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function InstagramVerificationsAdminPage() {
  const { user, loading } = useUser();
  const [filter, setFilter] = useState<Filter>("pending");

  const query = useQuery({
    ...listInstagramVerificationsOptions(
      filter === "all" ? {} : { query: { status: filter } },
    ),
    enabled: !!user?.is_admin,
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-pulse rounded-full bg-bg-subtle" />
      </div>
    );
  }

  if (!user?.is_admin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-text">
        <p className="text-text-muted">
          You don&apos;t have access to this page.
        </p>
        <Link href="/startups" className="text-sm text-brand hover:underline">
          ← Back to Narval
        </Link>
      </div>
    );
  }

  const rows = query.data ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border px-[var(--page-px)]">
        <Link
          href="/startups"
          className="text-sm text-text-muted transition-colors hover:text-text"
        >
          ← Back
        </Link>
        <span className="text-sm font-semibold">Instagram verifications</span>
        <span className="w-12" />
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-[var(--page-px)] py-8">
        <div className="mb-4 flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
                filter === f
                  ? "bg-brand-subtle text-brand-text"
                  : "text-text-muted hover:bg-bg-subtle hover:text-text"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg-subtle text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                <th className="px-3 py-2.5">Startup</th>
                <th className="px-3 py-2.5">Handle</th>
                <th className="px-3 py-2.5">Code</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Started</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-sm text-text-muted"
                  >
                    Loading…
                  </td>
                </tr>
              ) : query.isError ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-sm text-danger"
                  >
                    Failed to load verifications.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-sm text-text-muted"
                  >
                    No {filter === "all" ? "" : filter} verifications.
                  </td>
                </tr>
              ) : (
                rows.map((v) => <Row key={v.id} v={v} />)
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
