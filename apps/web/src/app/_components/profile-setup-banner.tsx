"use client";

import Link from "next/link";
import { AlertCircle, X } from "lucide-react";
import { useState } from "react";

interface ProfileSetupBannerProps {
  accountType: "startup";
  profileId: string;
}

export default function ProfileSetupBanner({
  profileId,
}: ProfileSetupBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const profilePath = `/startups/${profileId}`;

  return (
    <div className="bg-warning/10 border-b border-warning px-6 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
        <p className="text-sm text-text">
          Your profile is not fully set up.{" "}
          <Link
            href={profilePath}
            className="font-medium text-warning hover:text-warning/80 underline"
          >
            Complete your profile
          </Link>{" "}
          to appear in public listings.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-text-muted hover:text-text p-1 ml-4"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
