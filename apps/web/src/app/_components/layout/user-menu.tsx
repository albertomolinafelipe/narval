"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "supertokens-web-js/recipe/session";
import { useUser } from "@/lib/user";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, BadgeCheck, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAdminStartup } from "@/lib/api/gen";
import { unwrap } from "@/lib/api/unwrap";
import { useAuthModal } from "../auth/auth-modal-context";

export default function UserMenu() {
  const { user, authenticated, loading } = useUser();
  const { openModal } = useAuthModal();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profileSetup, setProfileSetup] = useState<boolean | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function handleNewProfile() {
    const name = window.prompt("Startup name for the new profile")?.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { id } = await unwrap(createAdminStartup({ body: { name } }));
      setOpen(false);
      router.push(`/startups/in/${id}/edit`);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Failed to create profile",
      );
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    async function checkProfileSetup() {
      if (!user || user.account_type !== "startup") return;
      const pid = user.profile_id;
      if (!pid) return;
      try {
        const res = await fetch(`/api/proxy/startups/${pid}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const profile = await res.json();
        setProfileSetup(profile.profile_setup);
        setProfileId(profile.id);
      } catch {
        // ignore
      }
    }
    checkProfileSetup();
  }, [user]);

  if (loading) {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-bg-subtle" />;
  }

  if (!authenticated || !user) {
    return (
      <Button
        type="button"
        onClick={openModal}
        className="max-md:px-2"
        aria-label="Sign in"
      >
        <span className="md:hidden">
          <User size={18} />
        </span>
        <span className="max-md:hidden">Sign in</span>
      </Button>
    );
  }

  const email = user.email;
  const initial = email.charAt(0).toUpperCase();
  const logoUrl = user.logo_url;
  const accountType = user.account_type;
  const hasProfile = accountType === "startup";
  const showProfileWarning = hasProfile && profileSetup === false;

  const profilePath = profileId ? `/startups/in/${profileId}` : "/startups";

  return (
    <div ref={ref} className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open user menu"
        className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border bg-bg-subtle transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${showProfileWarning ? "border-[var(--color-wip-text)] hover:border-[var(--color-wip-text)]" : "border-border hover:border-brand"}`}
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="Profile"
            width={36}
            height={36}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <span className="text-sm font-bold text-brand">{initial}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-bg-raised shadow-xl z-50">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-subtle">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Profile"
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-sm font-bold text-brand">
                    {initial}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-text">
                  {email}
                </p>
                {accountType && (
                  <p className="text-xs text-text-muted capitalize">
                    {accountType} account
                  </p>
                )}
              </div>
            </div>
          </div>

          {showProfileWarning && (
            <div className="mx-2 mt-2 rounded-lg bg-[var(--color-wip-text)]/10 border border-[var(--color-wip-text)]/40 px-3 py-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-[var(--color-wip-text)] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text">
                    Profile not fully set up
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Complete your profile to appear in listings
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-2">
            {user.is_admin && (
              <button
                type="button"
                onClick={handleNewProfile}
                disabled={creating}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text transition hover:bg-bg-subtle disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {creating ? "Creating…" : "New profile"}
              </button>
            )}
            {user.is_admin && (
              <Link
                href="/admin/instagram-verifications"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text transition hover:bg-bg-subtle"
              >
                <BadgeCheck className="h-4 w-4" />
                Instagram verifications
              </Link>
            )}
            {hasProfile && (
              <Link
                href={profilePath}
                onClick={() => setOpen(false)}
                className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-text transition hover:bg-bg-subtle"
              >
                Your profile
              </Link>
            )}
            <button
              type="button"
              onClick={async () => {
                await signOut();
                window.location.href = "/startups";
              }}
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-text transition hover:bg-bg-subtle"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
