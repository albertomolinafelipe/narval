"use client";

import { Rocket, BadgeCheck } from "lucide-react";
import { Avatar } from "@/app/_components/shared/list-panel";
import { useStartupsQuery } from "@/lib/api/use-startups-query";
import { cn } from "@/lib/utils";

/**
 * A floating home-hero card styled as a little window peeking at the startup
 * list — the top 5 trending startups: avatar + name (+ verified badge) + boosts.
 */
export function StartupListWindow({ className }: { className?: string }) {
  const { data: startups = [] } = useStartupsQuery({ sort: "trending" });
  const picks = startups.slice(0, 5);

  return (
    <div className={cn("flex flex-col", className)}>
      <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Top Startups
      </p>
      <div className="flex flex-col gap-1 overflow-hidden rounded-xl border border-border/60 bg-bg-raised/70 p-3 shadow-xl backdrop-blur-sm">
        {picks.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar entity={s} size={10} />
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="truncate text-base font-medium text-text">
                {s.name}
              </span>
              {s.verified && (
                <BadgeCheck size={15} className="shrink-0 text-brand" />
              )}
            </div>
            <span className="flex shrink-0 items-center gap-1 text-sm tabular-nums text-text-muted">
              <Rocket size={15} />
              {s.boost_count ?? 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
