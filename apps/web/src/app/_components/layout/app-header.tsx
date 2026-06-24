"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, X, User, LogOut } from "lucide-react";
import { signOut } from "supertokens-web-js/recipe/session";
import { useUser } from "@/lib/user";
import { useAuthModal } from "@/app/_components/auth/auth-modal-context";
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
  { label: "Awards", href: "/awards", wip: false },
];

export default function AppHeader({ customTab }: AppHeaderProps = {}) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, authenticated, loading } = useUser();
  const { openModal } = useAuthModal();

  // Close the mobile menu whenever the route changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMobileOpen(false), [pathname]);

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

  // Label of the section we're currently in (for the mobile breadcrumb).
  const sectionLabel = customTab
    ? baseTabs[0].label
    : (baseTabs.find((t) => pathname.startsWith(t.href))?.label ?? "Narval");

  const profilePath =
    user?.account_type === "startup" && user.profile_id
      ? `/startups/in/${user.profile_id}`
      : "/startups";

  return (
    <header className="relative flex h-14 flex-shrink-0 items-center justify-between border-b border-border px-6">
      {/* Left: logo + nav tabs (desktop) / breadcrumb (mobile) */}
      <nav className="flex min-w-0 items-center gap-3">
        <Link
          href="/"
          aria-label="Home"
          className="text-text transition-opacity hover:opacity-80"
        >
          <NarvalLogo className="h-7 w-7 rounded-sm" />
        </Link>
        <div className="h-4 w-px bg-border" />

        {/* Desktop tabs */}
        <div className="hidden items-center gap-3 md:flex">
          {tabs.map((tab, index) => {
            // Handle custom tab
            if ("custom" in tab) {
              return (
                <span
                  key={`custom-${index}`}
                  className="flex items-center gap-1.5"
                >
                  <ChevronRight size={14} className="text-text-subtle" />
                  <span className="rounded-md bg-bg-subtle px-3 py-1.5 text-sm font-medium text-text-muted">
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
                className="rounded-md bg-bg-subtle px-3 py-1.5 text-sm font-medium text-text"
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
        </div>

        {/* Mobile breadcrumb */}
        <div className="flex min-w-0 items-center gap-1.5 md:hidden">
          <span className="text-sm font-medium text-text">{sectionLabel}</span>
          {customTab && (
            <>
              <ChevronRight size={14} className="shrink-0 text-text-subtle" />
              <span className="max-w-[140px] truncate rounded-md bg-bg-subtle px-2 py-1 text-sm font-medium text-text-muted">
                {customTab.label}
              </span>
            </>
          )}
        </div>
      </nav>

      {/* Right: theme + user (desktop) / chevron (mobile) */}
      <div className="flex items-center gap-3">
        <div className="max-md:hidden">
          <ThemeToggle />
        </div>
        <div className="max-md:hidden">
          <UserMenu />
        </div>
        {!isHome && (
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-bg-subtle hover:text-text md:hidden"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        )}
      </div>

      {/* Mobile expanded menu */}
      {mobileOpen && (
        <>
          {/* Backdrop — tap outside to close */}
          <div
            className="fixed inset-x-0 bottom-0 top-14 z-40 bg-bg/20 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-x-0 top-14 z-50 flex flex-col gap-1 border-b border-border bg-bg/80 py-3 pl-6 pr-3 shadow-lg backdrop-blur-md md:hidden">
            {baseTabs.map((tab) => {
              const active = pathname.startsWith(tab.href);
              if (tab.wip) {
                return (
                  <span
                    key={tab.label}
                    className="wip rounded-lg px-3 py-2.5 text-sm font-medium"
                  >
                    {tab.label}
                  </span>
                );
              }
              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center rounded-lg border-l-2 px-3 py-2.5 text-sm transition ${
                    active
                      ? "border-brand bg-bg-subtle font-medium text-text"
                      : "border-transparent text-text-muted hover:bg-bg-subtle hover:text-text"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}

            {/* Profile / sign-in */}
            {!loading &&
              (authenticated && user ? (
                <div className="flex items-center gap-1">
                  <Link
                    href={profilePath}
                    onClick={() => setMobileOpen(false)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text transition hover:bg-bg-subtle"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-subtle">
                      {user.logo_url ? (
                        <Image
                          src={user.logo_url}
                          alt="Profile"
                          width={32}
                          height={32}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="text-xs font-bold text-brand">
                          {user.email.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="truncate">{user.email}</span>
                  </Link>
                  <button
                    type="button"
                    aria-label="Sign out"
                    onClick={async () => {
                      setMobileOpen(false);
                      await signOut();
                      window.location.href = "/startups";
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted transition hover:bg-bg-subtle hover:text-text"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    openModal();
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text transition hover:bg-bg-subtle"
                >
                  <User size={18} className="shrink-0" />
                  Sign in
                </button>
              ))}
          </div>
        </>
      )}
    </header>
  );
}
