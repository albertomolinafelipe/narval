"use client";

import Link from "next/link";

export function TrackedHomeButtons() {
  return (
    <div className="mt-10 flex gap-4">
      <Link href="/startups" className="btn-primary px-6 py-2.5 text-base">
        Browse Startups
      </Link>
      <Link
        href="/investors"
        className="btn-ghost px-6 py-2.5 text-base text-text"
      >
        Meet Investors
      </Link>
    </div>
  );
}
