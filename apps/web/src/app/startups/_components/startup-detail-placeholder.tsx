"use client";

import { Rocket, MousePointerClick, Award } from "lucide-react";
import { useUser } from "@/lib/user";
import { useStatsQuery } from "@/lib/api/use-stats-query";
import { BackgroundBlobs } from "@/app/_components/shared/background-blobs";

/** Shown in the persistent right panel when no startup is selected. */
export function StartupDetailPlaceholder() {
  const { authenticated, loading } = useUser();
  const { data: stats } = useStatsQuery();

  // Logged-out visitors get a welcome + early-adopter pitch.
  if (!loading && !authenticated) {
    return (
      <div className="relative flex h-full flex-col overflow-hidden">
        <BackgroundBlobs />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
          <span className="text-8xl" role="img" aria-label="waving hand">
            👋
          </span>
          <div className="max-w-md">
            <h2 className="text-4xl font-bold text-text">Hello</h2>
            <p className="mt-3 text-xl text-text-muted">
              We&apos;re just starting — thanks for taking a look while we try
              to get Narval off the ground.
            </p>
          </div>

          {/* Early adopter */}
          <div className="w-full max-w-md rounded-xl border border-border bg-bg-subtle/40 p-6 text-left">
            <div className="flex items-center gap-2.5">
              <Award size={26} className="text-brand" />
              <h3 className="text-xl font-semibold text-text">Early adopter</h3>
            </div>
            <p className="mt-2 text-base text-text-muted">
              Join as one of the first 100 users or 100 published startups and
              you&apos;ll earn an early adopter badge.
            </p>
            <div className="mt-5 flex flex-col gap-4">
              <ProgressBar
                label="Users"
                value={stats?.total_users ?? 0}
                goal={100}
              />
              <ProgressBar
                label="Startups"
                value={stats?.published_startups ?? 0}
                goal={100}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-2">
          <Rocket size={18} className="text-brand" />
          <h2 className="text-lg font-semibold text-text">Startup details</h2>
        </div>
        <p className="mt-0.5 text-sm text-text-muted">
          Select a startup from the list to see its profile here.
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
          <MousePointerClick size={24} />
        </div>
        <div className="max-w-xs">
          <p className="text-sm font-medium text-text">Nothing selected yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Click any startup on the left to preview its details. Click it again
            to open the full page.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({
  label,
  value,
  goal,
}: {
  label: string;
  value: number;
  goal: number;
}) {
  const pct = Math.min(100, (value / goal) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-base">
        <span className="text-text-muted">{label}</span>
        <span className="tabular-nums text-text-subtle">
          {value} / {goal}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-bg-subtle">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
