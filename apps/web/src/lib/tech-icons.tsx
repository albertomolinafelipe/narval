"use client";

import { Icon, addCollection } from "@iconify/react";
import deviconJson from "@iconify-json/devicon/icons.json";

const devicon = deviconJson as unknown as {
  prefix: string;
  icons: Record<string, unknown>;
};

// Register the Devicon set offline (no runtime network requests).
addCollection(devicon as Parameters<typeof addCollection>[0]);

const SLUGS = new Set(Object.keys(devicon.icons));

// Only irregular names need an alias; everything else resolves by probing the
// set below. We own zero colours/paths — those come from the Devicon package.
const ALIASES: Record<string, string> = {
  golang: "go",
  k8s: "kubernetes",
  postgres: "postgresql",
  node: "nodejs",
  tailwind: "tailwindcss",
  aws: "amazonwebservices",
  kafka: "apachekafka",
};

/** Resolve a free-form tech name to a `devicon:` slug, or null if unknown. */
function resolveSlug(name: string): string | null {
  const normalized = name.toLowerCase().trim().replace(/[.\s/]/g, "");
  const base = ALIASES[normalized] ?? ALIASES[name.toLowerCase().trim()] ?? normalized;
  if (SLUGS.has(base)) return base;
  return null;
}

export function hasTechIcon(name: string): boolean {
  return resolveSlug(name) !== null;
}

// Generic code glyph for tech with no brand logo (resolved by Iconify).
const FALLBACK_ICON = "material-symbols:code";

/**
 * Official brand logo for the tech, full colour. Falls back to a generic
 * "code" icon when the name has no brand logo.
 */
export function TechIcon({ name, size = 32 }: { name: string; size?: number }) {
  const slug = resolveSlug(name);
  return (
    <Icon
      icon={slug ? `devicon:${slug}` : FALLBACK_ICON}
      width={size}
      height={size}
      className={slug ? undefined : "text-text-subtle"}
    />
  );
}

/** Small icon node for inline use (e.g. compact panel pills). */
export function getTechIcon(name: string): React.ReactNode {
  return <TechIcon name={name} size={14} />;
}

/** Parse a comma-separated tech stack string into trimmed names. */
export function parseTechStack(techStack: string | null | undefined): string[] {
  if (!techStack) return [];
  return techStack
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
