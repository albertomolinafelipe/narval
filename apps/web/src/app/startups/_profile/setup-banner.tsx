"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackgroundBlobs } from "@/app/_components/shared/background-blobs";
import { useProfileEdit } from "./edit-context";

/**
 * Owner-only draft banner shown until the profile is published. Publishing flips
 * profile_setup to true, which makes the startup appear in public listings.
 */
export function SetupBanner() {
  const { save } = useProfileEdit();
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);

  const onPublish = async () => {
    setPublishing(true);
    try {
      await save({ profile_setup: true });
      router.refresh();
    } catch {
      // context surfaces the error toast; stay in draft so they can retry
      setPublishing(false);
    }
  };

  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-bg-raised px-6 py-5 shadow-sm max-md:-mx-4 max-md:rounded-none">
      <BackgroundBlobs />
      <div className="relative z-10 flex items-center gap-4 max-sm:flex-col max-sm:items-start">
        <Image
          src="/logo.jpeg"
          alt="Narval"
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 rounded-xl object-cover shadow-sm"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xl font-bold tracking-tight text-text">Hello 👋</p>
          <p className="max-w-2xl text-sm leading-relaxed text-text-muted">
            Your profile is still a draft, it won&apos;t appear in public
            listings until you publish it.
            <br />
            Want ideas first? Take a look at{" "}
            <Link
              href="/startups/gonarval.com"
              className="font-semibold text-brand underline decoration-brand/50 underline-offset-2 transition hover:decoration-brand"
            >
              our page
            </Link>{" "}
            for inspiration, then publish when you&apos;re ready.
          </p>
        </div>
        <Button
          onClick={onPublish}
          disabled={publishing}
          className="shrink-0 max-sm:w-full"
        >
          {publishing && <Loader2 size={16} className="animate-spin" />}
          {publishing ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </div>
  );
}
