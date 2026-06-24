"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Reserve space to avoid layout shift before mount.
  if (!mounted) {
    return <div className="h-8 w-16" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="h-8 gap-1.5 px-2.5 text-text-muted hover:text-text"
    >
      {isDark ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
      <span className="text-xs font-medium">{isDark ? "Light" : "Dark"}</span>
    </Button>
  );
}
