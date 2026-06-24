"use client";

import { Globe } from "lucide-react";
import { SiAppstore, SiGoogleplay } from "react-icons/si";
import { components } from "@/lib/api/generated";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Section } from "./ui";
import { GallerySection } from "./gallery-section";
import { FeaturesSection } from "./features-section";
import { useProfileEdit } from "./edit-context";

type Startup = components["schemas"]["Startup"];

const STATUSES: { value: string; label: string; className: string }[] = [
  { value: "coming-soon", label: "Coming soon", className: "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  { value: "waitlist",    label: "Waitlist open", className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { value: "beta",        label: "In beta",        className: "border-brand/30 bg-brand-subtle text-brand" },
  { value: "live",        label: "Live",            className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
];

const NONE = "none";

function StatusBadge({ value }: { value: string }) {
  const status = STATUSES.find((s) => s.value === value);
  if (!status) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${status.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.label}
    </span>
  );
}

function StatusEditor({ value }: { value: string }) {
  const { save } = useProfileEdit();
  return (
    <Select
      value={value || NONE}
      onValueChange={(val) => save({ product_status: val === NONE ? "" : val })}
    >
      <SelectTrigger className="w-fit gap-2 pr-3">
        {value ? <StatusBadge value={value} /> : <span className="text-text-subtle">No status</span>}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No status</SelectItem>
        {STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const PLATFORMS = [
  { key: "web",     label: "Web",         Icon: Globe },
  { key: "ios",     label: "App Store",   Icon: SiAppstore },
  { key: "android", label: "Google Play", Icon: SiGoogleplay },
] as const;

export function ProductTab({ startup }: { startup: Startup }) {
  const { isOwner } = useProfileEdit();

  let productLinks: Record<string, string> = {};
  try { productLinks = JSON.parse(startup.product_links ?? "{}"); } catch { /* ignore */ }

  const hasLinks    = Object.keys(productLinks).length > 0;
  const status      = startup.product_status ?? "";
  const hasFeatures = (() => { try { const f = JSON.parse(startup.features ?? "[]"); return Array.isArray(f) && f.length > 0; } catch { return false; } })();

  const AvailableOn = hasLinks ? (
    <Section title="Available on">
      <div className="flex flex-wrap gap-3">
        {PLATFORMS.filter((p) => productLinks[p.key]).map(({ key, label, Icon }) => (
          <a
            key={key}
            href={productLinks[key].startsWith("http") ? productLinks[key] : `https://${productLinks[key]}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-border bg-bg-subtle px-4 py-2.5 text-sm font-medium text-text transition hover:border-brand hover:bg-bg"
          >
            <Icon size={18} className="text-brand" />
            {label}
          </a>
        ))}
      </div>
    </Section>
  ) : null;

  // Owner always gets two columns so they can edit features/status.
  if (isOwner) {
    return (
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
        <div className="flex min-w-0 flex-col gap-8 lg:basis-[75%]">
          <GallerySection startup={startup} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-8 lg:basis-[25%]">
          <Section title="Launch status">
            <StatusEditor value={status} />
          </Section>
          <FeaturesSection startup={startup} />
          {AvailableOn}
        </div>
      </div>
    );
  }

  // Visitor: layout depends on what content exists.

  // Case 1: features exist → two columns.
  if (hasFeatures) {
    return (
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
        <div className="flex min-w-0 flex-col gap-8 lg:basis-[75%]">
          <GallerySection startup={startup} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-8 lg:basis-[25%]">
          {status && (
            <Section title="Status">
              <div className="inline-flex"><StatusBadge value={status} /></div>
            </Section>
          )}
          <FeaturesSection startup={startup} />
          {AvailableOn}
        </div>
      </div>
    );
  }

  // Case 2: no features, status exists → status above gallery, single column.
  if (status) {
    return (
      <div className="flex flex-col gap-8">
        <div className="inline-flex">
          <StatusBadge value={status} />
        </div>
        <GallerySection startup={startup} />
        {AvailableOn}
      </div>
    );
  }

  // Case 3: no features, no status → full-width gallery only.
  return (
    <div className="flex flex-col gap-8">
      <GallerySection startup={startup} />
      {AvailableOn}
    </div>
  );
}
