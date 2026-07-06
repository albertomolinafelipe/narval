import { Globe, BadgeCheck } from "lucide-react";
import { SiAppstore, SiGoogleplay } from "react-icons/si";
import { components } from "@/lib/api/generated";
import { Avatar } from "@/app/_components/shared/list-panel";
import { BoostCounter } from "@/app/_components/shared/boost-counter";
import { parseProductLinks } from "@/lib/startup/product-links";

type Startup = components["schemas"]["Startup"];

interface Props {
  startup: Startup;
  /** Detailed view — shows metadata columns and platform icons. */
  expanded: boolean;
  selected: boolean;
  onClick: () => void;
}

/** A single row in the startups list (list view). */
export function StartupListRow({ startup: s, expanded, selected, onClick }: Props) {
  const links = expanded ? parseProductLinks(s.product_links) : {};

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-bg-subtle ${
          s.has_boosted ? "bg-brand-subtle/10" : ""
        } ${selected ? "bg-bg-subtle" : ""}`}
      >
        <div className="shrink-0">
          <BoostCounter startup={s} />
        </div>
        <Avatar entity={s} size={12} />

        {/* Name + tagline — fills the space, pushing detail columns to the right */}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-medium text-text">
            <span className="truncate">{s.name}</span>
            {s.verified && <BadgeCheck size={13} className="shrink-0 text-brand" />}
          </p>
          {s.verified
            ? s.website && <p className="truncate text-xs text-text-muted">{s.website}</p>
            : s.contact_general && <p className="truncate text-xs text-text-muted">{s.contact_general}</p>
          }
          {(s.tagline || s.description) && (
            <p
              className={`mt-1 text-xs text-text-subtle max-md:hidden ${
                expanded ? "truncate" : "line-clamp-2"
              }`}
            >
              {s.tagline ?? s.description}
            </p>
          )}
        </div>

        {/* Metadata columns — only when expanded */}
        {expanded && (
          <>
            <span className="w-14 shrink-0 text-xs tabular-nums text-text-muted">
              {s.founded_year ?? "—"}
            </span>
            <span className="w-16 shrink-0 text-xs text-text-muted">
              {s.team_size ? `${s.team_size} ppl` : "—"}
            </span>
            <span className="w-24 shrink-0 truncate text-xs capitalize text-text-muted">
              {s.stage ?? "—"}
            </span>
            <span className="w-32 shrink-0 truncate text-xs text-text-muted">
              {s.industry ?? "—"}
            </span>
          </>
        )}

        {/* Platform icons — only in detailed view. Always reserve the column
            (even when empty) so the metadata columns line up across rows. */}
        {expanded && (
          <div className="flex w-16 shrink-0 items-center gap-2 text-text-subtle">
            {links.web && <Globe size={15} />}
            {links.ios && <SiAppstore size={15} />}
            {links.android && <SiGoogleplay size={15} />}
          </div>
        )}
      </button>
    </li>
  );
}
