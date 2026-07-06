import Image from "next/image";
import Link from "next/link";
import { Hammer } from "lucide-react";
import { cn } from "@/lib/utils";
import { StartupListWindow } from "@/app/startup-list-window";
import { WeeklyPickCard } from "@/app/weekly-pick-card";

/**
 * Decorative floating cards in the side gutters of the home hero. Left: the top-
 * startups list (→ /startups) above this week's pick, centered vertically. Right: the
 * map (→ the map view) above a "coming soon" card. Each bobs independently. They
 * sit behind the centered hero content (z-0, under the z-10 main, which is
 * pointer-events-none so these stay clickable). Desktop only.
 */
export function HomeWindows() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 hidden justify-between px-[13%] lg:flex">
      {/* Left — list window above "our pick", centered vertically */}
      <div className="flex flex-col justify-center gap-8">
        <Link
          href="/startups"
          aria-label="Browse startups"
          className="pointer-events-auto transition hover:opacity-90"
          style={{ animation: "window-float-1 7s ease-in-out infinite" }}
        >
          <StartupListWindow className="w-96" />
        </Link>
        <WeeklyPickCard
          className="w-96"
          style={{ animation: "window-float-2 11s ease-in-out infinite" }}
        />
      </div>

      {/* Right — map above coming soon */}
      <div className="flex flex-col items-end justify-center gap-12">
        <Link
          href="/startups?view=map"
          aria-label="Open the startups map"
          className="pointer-events-auto mr-4 transition hover:opacity-90"
          style={{ animation: "window-float-1 9s ease-in-out infinite" }}
        >
          <MapCard className="h-80 w-80" />
        </Link>
        <div
          aria-hidden
          className="mr-12"
          style={{ animation: "window-float-2 10s ease-in-out infinite" }}
        >
          <ComingSoonCard className="h-72 w-72" />
        </div>
      </div>
    </div>
  );
}

/** "Coming soon" placeholder card. */
function ComingSoonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-border/60 bg-bg-raised/70 p-6 text-center shadow-xl backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
        <Hammer size={30} />
      </div>
      <div>
        <p className="text-base font-semibold text-text">Coming soon</p>
        <p className="mt-1 text-sm text-text-muted">
          We are still working on everything
        </p>
      </div>
    </div>
  );
}

/** Static screenshot of the startups map — refreshed manually now and then. */
function MapCard({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col", className)}>
      <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Startups Map
      </p>
      <div className="relative flex-1 overflow-hidden rounded-xl border border-border/60 shadow-xl">
        <Image src="/map.png" alt="Map of startups" fill className="object-cover" />
      </div>
    </div>
  );
}
