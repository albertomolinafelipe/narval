"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import ThemeToggle from "@/app/_components/layout/theme-toggle";
import UserMenu from "@/app/_components/layout/user-menu";
import NarvalLogo from "@/app/_components/layout/narval-logo";

interface Tab {
  label: string;
  href: string;
  wip: boolean;
}

interface AppHeaderProps {
  /** Optional: Insert a custom tab (e.g., current startup name) after the first tab */
  customTab?: {
    label: string;
    active?: boolean;
  };
}

const baseTabs: Tab[] = [
  { label: "Startups", href: "/startups", wip: false },
  { label: "Investors", href: "/investors", wip: false },
  { label: "Awards", href: "/wip", wip: true },
  { label: "Events", href: "/wip", wip: true },
];

export default function AppHeader({ customTab }: AppHeaderProps = {}) {
  const pathname = usePathname();

  // Build the tabs array
  const tabs: (Tab | { label: string; active: boolean; custom: true })[] = [];

  // Add Startups tab
  tabs.push(baseTabs[0]);

  // Insert custom tab after Startups if provided
  if (customTab) {
    tabs.push({
      label: customTab.label,
      active: customTab.active ?? true,
      custom: true as const,
    });
  }

  // Add remaining tabs (Investors, Awards, Events)
  tabs.push(...baseTabs.slice(1));

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border px-6">
      {/* Left: logo + nav tabs */}
      <nav className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="Home"
          className="text-text transition-opacity hover:opacity-80"
        >
          <NarvalLogo className="h-9 w-9 rounded-sm" />
        </Link>
        <div className="h-4 w-px bg-border" />

        {tabs.map((tab, index) => {
          // Handle custom tab
          if ("custom" in tab) {
            return (
              <span
                key={`custom-${index}`}
                className="flex items-center gap-1.5"
              >
                <ChevronRight size={14} className="text-text-subtle" />
                <span className="rounded-md px-3 py-1.5 text-sm font-medium text-text-muted bg-bg-subtle">
                  {tab.label}
                </span>
              </span>
            );
          }

          // Handle WIP tabs
          if (tab.wip) {
            return (
              <span
                key={tab.label}
                title="Coming soon"
                className="wip rounded-md px-3 py-1.5 text-sm font-medium"
              >
                {tab.label}
              </span>
            );
          }

          // Handle regular tabs
          // When a custom tab is present, always make the first tab clickable (never show as active)
          const active = customTab ? false : pathname.startsWith(tab.href);
          return active ? (
            <span
              key={tab.label}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-text bg-bg-subtle"
            >
              {tab.label}
            </span>
          ) : (
            <Link
              key={tab.label}
              href={tab.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-text-muted transition hover:bg-bg-subtle hover:text-text"
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: theme + user */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
