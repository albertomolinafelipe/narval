import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg px-6 py-12 text-center">
      <div className="mb-6 rounded-full bg-bg-subtle p-4">
        <AlertCircle size={32} className="text-text-muted" />
      </div>
      <h1 className="mb-2 text-2xl font-semibold text-text">Page not found</h1>
      <p className="mb-6 max-w-md text-sm text-text-muted">
        The page you&apos;re looking for doesn&apos;t exist or may have been
        moved.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
      >
        Go home
      </Link>
    </div>
  );
}
