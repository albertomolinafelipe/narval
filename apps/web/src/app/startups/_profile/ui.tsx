// Shared presentational helpers for the startup profile (tabs + compact panel).

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function Section({
  title,
  wip,
  children,
}: {
  title: string;
  wip?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={wip ? "wip" : ""}>
      <SectionHeading>{title}</SectionHeading>
      {children}
    </section>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-subtle">
      {children}
    </h2>
  );
}

export function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  const url =
    href.startsWith("http") || href.startsWith("mailto:")
      ? href
      : `https://${href}`;
  return (
    <Badge asChild variant="secondary">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={label}
      >
        {children}
        <span>{label}</span>
      </a>
    </Badge>
  );
}

// Placeholder for tab sections that are empty or not yet built.
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-bg-subtle/30 px-6 py-16 text-center">
      <p className="text-sm font-medium text-text-muted">{title}</p>
      {hint && (
        <p className="mx-auto mt-1 max-w-sm text-xs text-text-subtle">{hint}</p>
      )}
    </div>
  );
}
