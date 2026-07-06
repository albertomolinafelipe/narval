import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

// This Week's Pick — edit these four fields to change the featured startup.
const PICK = {
  /** Display name of the startup. */
  name: "Narval",
  /** Where the card links to (e.g. a startup profile). */
  link: "/startups/gonarval.com",
  /** URL of the startup's profile picture (logo/avatar). */
  pfp: "/logo.jpeg",
  /** A short comment about why it's this week's pick. */
  comment: "Getting things started",
};

/** "This Week's Pick" home-hero card — a single featured startup. */
export function WeeklyPickCard({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Link
      href={PICK.link}
      aria-label={`View ${PICK.name}`}
      className={cn(
        "pointer-events-auto flex flex-col transition hover:opacity-90",
        className,
      )}
      style={style}
    >
      <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
        This Week&apos;s Pick
      </p>
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-bg-raised/70 p-4 shadow-xl backdrop-blur-sm">
        {/* Plain img: pfp may be a remote URL not whitelisted for next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PICK.pfp}
          alt={PICK.name}
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-text">
            {PICK.name}
          </p>
          <p className="truncate text-sm text-text-muted">{PICK.comment}</p>
        </div>
      </div>
    </Link>
  );
}
