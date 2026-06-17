"use client";

import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Check if it's a 404-like error
  const is404 =
    error.message.includes("404") ||
    error.message.includes("not found") ||
    error.message.includes("Not Found");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="mb-2 rounded-full bg-bg-subtle p-4">
        <AlertCircle size={32} className="text-text-muted" />
      </div>

      <h2 className="text-lg font-semibold text-text">
        {is404 ? "Page not found" : "Something went wrong"}
      </h2>

      <p className="max-w-md text-sm text-text-muted">
        {is404
          ? "The page you're looking for doesn't exist or may have been moved."
          : "An unexpected error occurred. Please try again."}
      </p>

      {!is404 && error.message && (
        <p className="max-w-md text-xs text-text-muted/70">{error.message}</p>
      )}

      <div className="mt-2 flex gap-2">
        {!is404 && (
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text transition hover:bg-bg-subtle"
          >
            <RefreshCw size={16} />
            Try again
          </button>
        )}

        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
        >
          <Home size={16} />
          Go home
        </Link>
      </div>
    </div>
  );
}
