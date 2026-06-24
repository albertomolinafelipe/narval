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
import { Section, EmptyState } from "./ui";
import { GallerySection } from "./gallery-section";
import { FeaturesSection } from "./features-section";
import { useProfileEdit } from "./edit-context";

type Startup = components["schemas"]["Startup"];

/** Launch-status options. Empty value = no status shown. */
const STATUSES: { value: string; label: string; className: string }[] = [
  { value: "coming-soon", label: "Coming soon", className: "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  { value: "waitlist", label: "Waitlist open", className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { value: "beta", label: "In beta", className: "border-brand/30 bg-brand-subtle text-brand" },
  { value: "live", label: "Live", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
];

const NONE = "none";

function StatusBadge({ value }: { value: string }) {
  const status = STATUSES.find((s) => s.value === value);
  if (!status) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${status.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.label}
    </span>
  );
}

/** Owner control to set/clear the launch status; saves immediately on change. */
function StatusEditor({ value }: { value: string }) {
  const { save } = useProfileEdit();
  return (
    <Select
      value={value || NONE}
      onValueChange={(val) =>
        save({ product_status: val === NONE ? "" : val })
      }
    >
      <SelectTrigger className="w-fit gap-2 pr-3">
        {value ? <StatusBadge value={value} /> : <span className="text-text-subtle">No status</span>}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No status</SelectItem>
        {STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ProductTab({ startup }: { startup: Startup }) {
  const { isOwner } = useProfileEdit();

  let productLinks: Record<string, string> = {};
  if (startup.product_links) {
    try {
      productLinks = JSON.parse(startup.product_links);
    } catch {
      /* ignore */
    }
  }

  const hasLinks = Object.keys(productLinks).length > 0;
  const status = startup.product_status ?? "";

  let hasFeatures = false;
  if (startup.features) {
    try {
      const f = JSON.parse(startup.features);
      hasFeatures = Array.isArray(f) && f.length > 0;
    } catch {
      /* ignore */
    }
  }

  let hasGallery = false;
  if (startup.gallery) {
    try {
      const g = JSON.parse(startup.gallery);
      hasGallery = Array.isArray(g) && g.length > 0;
    } catch {
      /* ignore */
    }
  }


  const PLATFORMS: { key: string; label: string; Icon: typeof Globe }[] = [
    { key: "web", label: "Web", Icon: Globe },
    { key: "ios", label: "App Store", Icon: SiAppstore },
    { key: "android", label: "Google Play", Icon: SiGoogleplay },
  ];

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
      {/* Left column — screenshots (~65%) */}
      <div className="flex min-w-0 flex-col gap-8 lg:basis-2/3">
        <GallerySection startup={startup} />
      </div>

      {/* Right column — text (~35%) */}
      <div className="flex min-w-0 flex-1 flex-col gap-8 lg:basis-1/3">
        {/* Launch status — owner gets the editor, visitors a badge (only when set). */}
        {isOwner ? (
          <Section title="Launch status">
            <StatusEditor value={status} />
          </Section>
        ) : (
          status && (
            <Section title="Status">
              <div className="inline-flex"><StatusBadge value={status} /></div>
            </Section>
          )
        )}

        {/* Key features */}
        <FeaturesSection startup={startup} />

        {/* Available on — promoted platform links (set from the create/edit form). */}
        {hasLinks && (
          <Section title="Available on">
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.filter((p) => productLinks[p.key]).map(({ key, label, Icon }) => (
                <a
                  key={key}
                  href={
                    productLinks[key].startsWith("http")
                      ? productLinks[key]
                      : `https://${productLinks[key]}`
                  }
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
        )}
      </div>
    </div>
  );
}
