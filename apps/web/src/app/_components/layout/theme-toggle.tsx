"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Reserve space to avoid layout shift before mount.
  if (!mounted) {
    return <div className="h-8 w-14" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="relative inline-flex h-8 w-14 items-center rounded-full border border-border bg-bg-subtle p-1 shadow-sm transition-colors hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <span
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full bg-bg text-text shadow-sm transition-transform duration-300 ease-in-out",
          isDark ? "translate-x-[22px]" : "translate-x-0",
        )}
      >
        {isDark ? <Moon size={14} aria-hidden /> : <Sun size={14} aria-hidden />}
      </span>
    </button>
  );
}
