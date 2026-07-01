"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="mb-8 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-brand via-brand to-indigo-700 px-6 py-5 text-white shadow-sm max-sm:flex-col max-sm:items-start max-md:-mx-6 max-md:rounded-none">
      <Image
        src="/logo.jpeg"
        alt="Narval"
        width={64}
        height={64}
        className="h-16 w-16 shrink-0 rounded-xl object-cover shadow-sm"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xl font-bold tracking-tight">Hello 👋</p>
        <p className="max-w-2xl text-sm leading-relaxed text-white/90">
          Your profile is still a draft, it won&apos;t appear in public listings
          until you publish it.
          <br />
          Want ideas first? Take a look at{" "}
          <Link
            href="/startups/gonarval.com"
            className="font-semibold text-white underline decoration-white/60 underline-offset-2 transition hover:decoration-white"
          >
            our page
          </Link>{" "}
          for inspiration, then publish when you&apos;re ready.
        </p>
      </div>
      <Button
        onClick={onPublish}
        disabled={publishing}
        className="shrink-0 bg-white text-brand hover:bg-white/90 max-sm:w-full"
      >
        {publishing && <Loader2 size={16} className="animate-spin" />}
        {publishing ? "Publishing…" : "Publish"}
      </Button>
    </div>
  );
}
