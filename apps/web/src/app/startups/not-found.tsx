import Link from "next/link";
import { AlertCircle } from "lucide-react";
import AppHeader from "@/app/_components/layout/app-header";

export default function StartupNotFound() {
  return (
    <div className="flex h-screen flex-col bg-bg">
      <AppHeader />

      <main className="flex flex-1 flex-col items-center justify-center px-[var(--page-px)] py-12 text-center">
        <div className="mb-6 rounded-full bg-bg-subtle p-4">
          <AlertCircle size={32} className="text-text-muted" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-text">
          Startup not found
        </h1>
        <p className="mb-6 max-w-md text-sm text-text-muted">
          This startup may have been removed or the link may be outdated. Try
          refreshing the startups list or check the URL.
        </p>
        <Link
          href="/startups"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
        >
          Back to Startups
        </Link>
      </main>
    </div>
  );
}
