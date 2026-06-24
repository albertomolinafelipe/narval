import Link from "next/link";
import AppHeader from "@/app/_components/layout/app-header";
import NarvalLogo from "@/app/_components/layout/narval-logo";
import { HomeHero } from "@/app/home-hero";

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
        {/* Animated decorative blobs */}
        <div
          className="pointer-events-none absolute -left-48 -top-48 h-[700px] w-[700px] rounded-full opacity-40"
          style={{
            background: "var(--color-brand)",
            filter: "blur(130px)",
            animation: "blob-drift-1 10s ease-in-out infinite",
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-48 right-0 h-[600px] w-[600px] rounded-full opacity-30"
          style={{
            background: "var(--color-brand)",
            filter: "blur(110px)",
            animation: "blob-drift-2 13s ease-in-out infinite",
          }}
        />
        <div
          className="pointer-events-none absolute bottom-1/3 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full opacity-20"
          style={{
            background: "var(--color-brand)",
            filter: "blur(90px)",
            animation: "blob-drift-3 16s ease-in-out infinite",
          }}
        />

        {/* Header sits on top of the banner */}
        <AppHeader />

        {/* Hero content — centered in remaining space */}
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
          <NarvalLogo className="mb-8 h-64 w-64 rounded-2xl max-md:h-44 max-md:w-44" />
          <h1 className="text-8xl font-bold tracking-tight text-text max-md:text-6xl">
            Narval
          </h1>
          <HomeHero />
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
