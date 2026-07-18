/**
 * Selector layer for a `Startup`'s outbound links — the single source of truth
 * for "which links a startup has, with what icon and label". Every view (compact
 * panel, full page, list row) derives its links from here so the set can't drift.
 * See AGENTS.md → "Rendering pattern — one entity, many views".
 */
import type { ComponentType } from "react";
import { Globe, Mail } from "lucide-react";
import {
  SiLinkedin,
  SiX,
  SiGithub,
  SiInstagram,
  SiAppstore,
  SiGoogleplay,
} from "react-icons/si";
import type { Startup } from "@/lib/api/gen";
import { parseProductLinks } from "./product-links";

export interface StartupLink {
  id: string;
  label: string;
  href: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
}

/** A prefix-based social platform (handle appended to `prefix` forms the URL).
 * The single registry of platform id/label/icon/prefix — every social view
 * (read-only selector below, inline editor in `_profile/socials.tsx`) derives
 * from this so the set can't drift. */
export interface SocialPlatform {
  id: "linkedin" | "twitter" | "instagram" | "github";
  label: string;
  prefix: string;
  placeholder: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  get: (s: Startup) => string;
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: "linkedin",
    label: "LinkedIn",
    prefix: "https://linkedin.com/company/",
    placeholder: "yourcompany",
    Icon: SiLinkedin,
    get: (s) => s.linkedin ?? "",
  },
  {
    id: "twitter",
    label: "X",
    prefix: "https://x.com/",
    placeholder: "yourhandle",
    Icon: SiX,
    get: (s) => s.twitter ?? "",
  },
  {
    id: "instagram",
    label: "Instagram",
    prefix: "https://instagram.com/",
    placeholder: "yourhandle",
    Icon: SiInstagram,
    get: (s) => s.instagram ?? "",
  },
  {
    id: "github",
    label: "GitHub",
    prefix: "https://github.com/",
    placeholder: "yourorg",
    Icon: SiGithub,
    get: (s) => s.github ?? "",
  },
];

/** Website, contact email, and social profiles, in display order. */
export function getStartupSocials(s: Startup): StartupLink[] {
  const links: StartupLink[] = [];
  if (s.website)
    links.push({
      id: "website",
      label: s.website.replace(/^https?:\/\//, ""),
      href: s.website,
      Icon: Globe,
    });
  if (s.contact_general)
    links.push({
      id: "email",
      label: s.contact_general,
      href: `mailto:${s.contact_general}`,
      Icon: Mail,
    });
  for (const p of SOCIAL_PLATFORMS) {
    const value = p.get(s);
    if (value)
      links.push({ id: p.id, label: p.label, href: value, Icon: p.Icon });
  }
  return links;
}

/** Product availability links (web app, App Store, Google Play). */
export function getStartupProductLinks(s: Startup): StartupLink[] {
  const links = parseProductLinks(s.product_links);
  const out: StartupLink[] = [];
  if (links.web)
    out.push({
      id: "web",
      label: "Try it online",
      href: links.web,
      Icon: Globe,
    });
  if (links.ios)
    out.push({
      id: "ios",
      label: "App Store",
      href: links.ios,
      Icon: SiAppstore,
    });
  if (links.android)
    out.push({
      id: "android",
      label: "Google Play",
      href: links.android,
      Icon: SiGoogleplay,
    });
  return out;
}
