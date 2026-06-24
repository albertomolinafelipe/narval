"use client";

import { useState, type ComponentType } from "react";
import { Plus, Check, X, Pencil, Globe } from "lucide-react";
import { SiLinkedin, SiX, SiInstagram, SiAppstore, SiGoogleplay } from "react-icons/si";
import { components } from "@/lib/api/generated";
import PrefixInput from "@/app/_components/shared/prefix-input";
import { useProfileEdit } from "./edit-context";
import { useInlineEdit } from "./editable";

type Startup = components["schemas"]["Startup"];
type UpdateStartupRequest = components["schemas"]["UpdateStartupRequest"];

function parseProductLinks(raw?: string | null): Record<string, string> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

interface LinkDef {
  id: string;
  label: string;
  /** Overrides the displayed text in non-editing mode (falls back to suffix then label). */
  displayLabel?: string;
  prefix: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  placeholder: string;
  getValue: (startup: Startup) => string;
  saveValue: (suffix: string, startup: Startup) => UpdateStartupRequest;
}

const LINKS: LinkDef[] = [
  {
    id: "linkedin",
    label: "LinkedIn",
    prefix: "https://linkedin.com/company/",
    Icon: SiLinkedin,
    placeholder: "yourcompany",
    getValue: (s) => s.linkedin ?? "",
    saveValue: (suffix) => ({ linkedin: suffix ? `https://linkedin.com/company/${suffix}` : "" }),
  },
  {
    id: "twitter",
    label: "X",
    prefix: "https://x.com/",
    Icon: SiX,
    placeholder: "yourhandle",
    getValue: (s) => s.twitter ?? "",
    saveValue: (suffix) => ({ twitter: suffix ? `https://x.com/${suffix}` : "" }),
  },
  {
    id: "instagram",
    label: "Instagram",
    prefix: "https://instagram.com/",
    Icon: SiInstagram,
    placeholder: "yourhandle",
    getValue: (s) => s.instagram ?? "",
    saveValue: (suffix) => ({ instagram: suffix ? `https://instagram.com/${suffix}` : "" }),
  },
  {
    id: "ios",
    label: "App Store",
    displayLabel: "iOS",
    prefix: "https://apps.apple.com/",
    Icon: SiAppstore,
    placeholder: "app/your-app/id…",
    getValue: (s) => parseProductLinks(s.product_links)["ios"] ?? "",
    saveValue: (suffix, s) => {
      const links = parseProductLinks(s.product_links);
      const url = suffix ? `https://apps.apple.com/${suffix}` : "";
      if (url) links["ios"] = url; else delete links["ios"];
      return { product_links: JSON.stringify(links) };
    },
  },
  {
    id: "android",
    label: "Google Play",
    displayLabel: "Android",
    prefix: "https://play.google.com/",
    Icon: SiGoogleplay,
    placeholder: "store/apps/details?id=…",
    getValue: (s) => parseProductLinks(s.product_links)["android"] ?? "",
    saveValue: (suffix, s) => {
      const links = parseProductLinks(s.product_links);
      const url = suffix ? `https://play.google.com/${suffix}` : "";
      if (url) links["android"] = url; else delete links["android"];
      return { product_links: JSON.stringify(links) };
    },
  },
];

function stripPrefix(url: string, prefix: string): string {
  const normalized = url.replace("https://www.", "https://");
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : url;
}

function EditableLink({
  def,
  startup,
  defaultEditing = false,
  onClose,
}: {
  def: LinkDef;
  startup: Startup;
  defaultEditing?: boolean;
  onClose?: () => void;
}) {
  const { isOwner, save } = useProfileEdit();
  const value = def.getValue(startup);
  const suffix = stripPrefix(value, def.prefix);

  const edit = useInlineEdit(
    suffix,
    (next) => save(def.saveValue(next.trim(), startup)),
    defaultEditing,
  );

  const { Icon } = def;

  if (!edit.editing) {
    const inner = (
      <>
        <Icon size={18} className="shrink-0" />
        <span className="truncate">{def.displayLabel ?? suffix ?? def.label}</span>
      </>
    );

    if (!isOwner) {
      if (!value) return null;
      return (
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-text transition hover:text-brand/80"
        >
          {inner}
        </a>
      );
    }

    return (
      <button type="button" onClick={edit.start}
        className="group flex items-center gap-2 text-sm text-text transition hover:text-brand/80"
      >
        {inner}
        <Pencil size={13} className="shrink-0 text-text-subtle opacity-0 transition group-hover:opacity-100" />
      </button>
    );
  }

  const commit = async () => { await edit.commit(edit.draft.trim()); onClose?.(); };
  const cancel = () => { edit.cancel(); onClose?.(); };

  return (
    <div className="flex items-center gap-1">
      <PrefixInput
        prefix={def.prefix.replace("https://", "")}
        value={edit.draft}
        disabled={edit.saving}
        placeholder={def.placeholder}
        autoFocus
        onChange={edit.setDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") cancel();
        }}
        className="w-52 bg-bg-raised"
        inputClassName="text-xs"
      />
      <button type="button" onClick={commit} disabled={edit.saving} aria-label="Save"
        className="shrink-0 rounded p-1 text-success transition hover:bg-success/10 disabled:opacity-50"
      >
        <Check size={16} />
      </button>
      <button type="button" onClick={cancel} disabled={edit.saving} aria-label="Cancel"
        className="shrink-0 rounded p-1 text-danger transition hover:bg-danger/10 disabled:opacity-50"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// Website — editable plain URL (no fixed prefix).
function EditableWebsite({ value }: { value: string }) {
  const { isOwner, save } = useProfileEdit();
  const edit = useInlineEdit(value, (next) =>
    save({ website: next.trim() } as UpdateStartupRequest),
  );

  if (!edit.editing) {
    const label = value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
    const inner = (
      <>
        <Globe size={18} className="shrink-0" />
        <span className="truncate">{label}</span>
      </>
    );

    if (!isOwner) {
      if (!value) return null;
      return (
        <a href={value.startsWith("http") ? value : `https://${value}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-text transition hover:text-brand/80"
        >
          {inner}
        </a>
      );
    }

    return (
      <button type="button" onClick={edit.start}
        className="group flex items-center gap-2 text-sm text-text transition hover:text-brand/80"
      >
        {value ? inner : (
          <span className="flex items-center gap-2 text-text-subtle">
            <Globe size={18} className="shrink-0" /> Add website
          </span>
        )}
        <Pencil size={12} className="shrink-0 text-text-subtle opacity-0 transition group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus value={edit.draft} disabled={edit.saving} placeholder="acme.com"
        onChange={(e) => edit.setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); edit.commit(edit.draft.trim()); }
          if (e.key === "Escape") edit.cancel();
        }}
        className="w-52 rounded-lg border border-border bg-bg px-2 py-1 text-sm text-text outline-none focus:border-brand"
      />
      <button type="button" onClick={() => edit.commit(edit.draft.trim())} disabled={edit.saving} aria-label="Save"
        className="shrink-0 rounded p-1 text-success transition hover:bg-success/10 disabled:opacity-50"
      >
        <Check size={16} />
      </button>
      <button type="button" onClick={edit.cancel} disabled={edit.saving} aria-label="Cancel"
        className="shrink-0 rounded p-1 text-danger transition hover:bg-danger/10 disabled:opacity-50"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function SocialsColumn({ startup }: { startup: Startup }) {
  const { isOwner } = useProfileEdit();
  const [adding, setAdding] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const present = LINKS.filter((l) => l.getValue(startup));
  const addingDefs = LINKS.filter((l) => adding.includes(l.id) && !l.getValue(startup));
  const missing = LINKS.filter((l) => !l.getValue(startup) && !adding.includes(l.id));

  if (!isOwner && present.length === 0 && !startup.website) return null;

  return (
    <div className="flex shrink-0 flex-col items-start gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-subtle">
        Links
      </span>
      <EditableWebsite value={startup.website ?? ""} />
      {present.map((def) => (
        <EditableLink key={def.id} def={def} startup={startup} />
      ))}
      {addingDefs.map((def) => (
        <EditableLink
          key={def.id} def={def} startup={startup} defaultEditing
          onClose={() => setAdding((a) => a.filter((id) => id !== def.id))}
        />
      ))}
      {isOwner && missing.length > 0 && (
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1 text-xs text-text-subtle transition hover:text-text"
          >
            <Plus size={14} /> Add
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 rounded-lg border border-border bg-bg p-1 shadow-lg">
              {missing.map((def) => (
                <button key={def.id} type="button"
                  onClick={() => { setAdding((a) => [...a, def.id]); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-text transition hover:bg-bg-subtle"
                >
                  <def.Icon size={14} /> {def.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
