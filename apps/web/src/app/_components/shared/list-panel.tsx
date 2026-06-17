"use client";

/**
 * Shared small components used by both the startups and investors list pages.
 */

import Image from "next/image";

//  Avatar

interface AvatarEntity {
  name: string;
  logo_url?: string | null;
}

export function Avatar({
  entity,
  size,
}: {
  entity: AvatarEntity;
  size: number;
}) {
  const px = size * 4; // size is in Tailwind units (1 unit = 4px)
  return (
    <div
      style={{ width: px, height: px, minWidth: px }}
      className="flex items-center justify-center overflow-hidden rounded-lg bg-brand-subtle"
    >
      {entity.logo_url ? (
        <Image
          src={entity.logo_url}
          alt={`${entity.name} logo`}
          width={px}
          height={px}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="font-bold text-brand-text"
          style={{ fontSize: Math.max(10, px * 0.35) }}
        >
          {entity.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

//  Pill

export function Pill({
  icon,
  label,
  variant = "default",
}: {
  icon?: React.ReactNode;
  label: string;
  variant?: "default" | "accent" | "code";
}) {
  const cls =
    variant === "accent"
      ? "border-brand/30 bg-brand-subtle text-brand-text"
      : variant === "code"
        ? "border-border bg-bg-raised font-mono text-text-subtle"
        : "border-border bg-bg-subtle text-text-muted";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${cls}`}
    >
      {icon}
      {label}
    </span>
  );
}

//  IconButton

export function IconButton({
  label,
  disabled,
  wip,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  wip?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled || wip}
      onClick={wip ? undefined : onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
        wip
          ? "wip"
          : "text-text-subtle hover:bg-bg-subtle hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
      }`}
    >
      {children}
    </button>
  );
}
