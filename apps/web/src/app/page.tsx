import Link from "next/link";
import AppHeader from "@/app/_components/layout/app-header";
import NarvalLogo from "@/app/_components/layout/narval-logo";
import { HomeHero } from "@/app/home-hero";
import { HomeWindows } from "@/app/home-windows";
import { BackgroundBlobs } from "@/app/_components/shared/background-blobs";

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
        <BackgroundBlobs />

        {/* Floating decorative windows — desktop only, behind hero content */}
        <HomeWindows />

        {/* Header sits on top of the banner */}
        <AppHeader />

        {/* Hero content — centered in remaining space */}
        <main className="pointer-events-none relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
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
