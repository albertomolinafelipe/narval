import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <header className="flex h-14 flex-shrink-0 items-center px-6 border-b border-border">
        <Link
          href="/"
          className="text-sm text-text-muted hover:text-text transition-colors"
        >
          ← Back
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">About Narval</h1>

        <p className="mt-6 text-text-muted leading-relaxed">WHAT IS NARVAL</p>

        <p className="mt-4 text-text-muted leading-relaxed">OUR GOAL</p>

        <h2 className="mt-10 text-lg font-semibold">Who it&apos;s for</h2>
        <ul className="mt-3 space-y-2 text-text-muted">
          <li>
            <span className="font-medium text-text">Founders</span> — ...
          </li>
          <li>
            <span className="font-medium text-text">Investors</span>- ...
          </li>
        </ul>
      </main>
    </div>
  );
}
