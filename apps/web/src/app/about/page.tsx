import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <header className="flex h-14 flex-shrink-0 items-center px-[var(--page-px)] border-b border-border">
        <Link
          href="/"
          className="text-sm text-text-muted hover:text-text transition-colors"
        >
          ← Back
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-[var(--page-px)] py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">About Narval</h1>

        <p className="mt-6 max-w-md text-text-muted leading-relaxed">
          We could write a boring About page about ourselves… but we built a
          whole platform for exactly that. So we use it.
        </p>

        <Link
          href="/startups/gonarval.com"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand/90"
        >
          Meet us on Narval →
        </Link>
      </main>
    </div>
  );
}
