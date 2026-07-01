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
import type { components } from "@/lib/api/generated";
import { parseProductLinks } from "./product-links";

type Startup = components["schemas"]["Startup"];

export interface StartupLink {
  id: string;
  label: string;
  href: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
}

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
  if (s.linkedin)
    links.push({ id: "linkedin", label: "LinkedIn", href: s.linkedin, Icon: SiLinkedin });
  if (s.twitter)
    links.push({ id: "twitter", label: "X / Twitter", href: s.twitter, Icon: SiX });
  if (s.instagram)
    links.push({ id: "instagram", label: "Instagram", href: s.instagram, Icon: SiInstagram });
  if (s.github)
    links.push({ id: "github", label: "GitHub", href: s.github, Icon: SiGithub });
  return links;
}

/** Product availability links (web app, App Store, Google Play). */
export function getStartupProductLinks(s: Startup): StartupLink[] {
  const links = parseProductLinks(s.product_links);
  const out: StartupLink[] = [];
  if (links.web)
    out.push({ id: "web", label: "Try it online", href: links.web, Icon: Globe });
  if (links.ios)
    out.push({ id: "ios", label: "App Store", href: links.ios, Icon: SiAppstore });
  if (links.android)
    out.push({ id: "android", label: "Google Play", href: links.android, Icon: SiGoogleplay });
  return out;
}
