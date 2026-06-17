import Link from "next/link";
import AppHeader from "@/app/_components/layout/app-header";
import NarvalLogo from "@/app/_components/layout/narval-logo";
import { TrackedHomeButtons } from "@/app/tracked-home-buttons";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      {/* Full-screen banner */}
      <div
        className="relative flex flex-1 flex-col overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, var(--color-brand-subtle) 0%, var(--color-bg-raised) 60%, var(--color-bg-subtle) 100%)",
        }}
      >
        {/* Decorative blobs */}
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full opacity-30"
          style={{ background: "var(--color-brand)", filter: "blur(100px)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 right-12 h-72 w-72 rounded-full opacity-20"
          style={{ background: "var(--color-brand)", filter: "blur(80px)" }}
        />

        {/* Header sits on top of the banner */}
        <AppHeader />

        {/* Hero content — centered in remaining space */}
        <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <NarvalLogo className="mb-6 h-48 w-48 rounded-lg" />
          <h1 className="text-5xl font-bold tracking-tight text-text">
            Narval
          </h1>
          <p className="mt-4 max-w-md text-lg text-text-muted">
            Discover startups. Connect with investors. Build what matters.
          </p>

          <TrackedHomeButtons />
        </main>

        {/* Footer */}
        <footer className="flex h-14 flex-shrink-0 items-center justify-center gap-4 text-sm text-text-subtle">
          <span>© {new Date().getFullYear()} Narval</span>
          <span>·</span>
          <Link
            href="/about"
            className="hover:text-text-muted transition-colors"
          >
            About
          </Link>
        </footer>
      </div>
    </div>
  );
}
