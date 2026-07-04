"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { SlideSwitch } from "@/components/ui/slide-switch";

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
    <SlideSwitch
      checked={isDark}
      onCheckedChange={(next) => setTheme(next ? "dark" : "light")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? <Moon size={14} aria-hidden /> : <Sun size={14} aria-hidden />}
    </SlideSwitch>
  );
}
