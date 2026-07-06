"use client";

import { useState, type ComponentType } from "react";
import { Plus, Check, X, Pencil, Globe } from "lucide-react";
import { InstagramGradientIcon } from "@/app/_components/shared/instagram-icon";
import { SiLinkedin, SiX, SiInstagram, SiAppstore, SiGoogleplay } from "react-icons/si";
import { components } from "@/lib/api/generated";
import { parseProductLinks } from "@/lib/startup/product-links";
import { normalizeToHandle } from "@/lib/startup/social-input";
import PrefixInput from "@/app/_components/shared/prefix-input";
import { useProfileEdit } from "./edit-context";
import { useInlineEdit } from "./editable";

type Startup = components["schemas"]["Startup"];
type UpdateStartupRequest = components["schemas"]["UpdateStartupRequest"];

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
  const suffix = normalizeToHandle(value, def.prefix).handle;
  const [error, setError] = useState<string | null>(null);

  const edit = useInlineEdit(
    suffix,
    (next) => save(def.saveValue(next.trim(), startup)),
    defaultEditing,
  );

  const { Icon } = def;
  // Bound to the handle, not just the flag: the backend clears instagram_verified
  // whenever the handle changes, so the badge can never sit on an unverified handle.
  const verified = def.id === "instagram" && !!startup.instagram_verified;

  if (!edit.editing) {
    const inner = (
      <>
        {verified ? (
          <InstagramGradientIcon size={18} className="shrink-0" />
        ) : (
          <Icon size={18} className="shrink-0" />
        )}
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

  const commit = async () => {
    if (error) return;
    // Changing a verified Instagram handle drops the verification server-side, so
    // make the owner confirm the trade-off before saving a different handle.
    if (
      verified &&
      edit.draft.trim() !== suffix &&
      !window.confirm(
        "Changing your Instagram handle will remove your verified badge. Continue?",
      )
    ) {
      return;
    }
    await edit.commit(edit.draft.trim());
    onClose?.();
  };
  const cancel = () => { setError(null); edit.cancel(); onClose?.(); };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <PrefixInput
          prefix={def.prefix.replace("https://", "")}
          value={edit.draft}
          disabled={edit.saving}
          invalid={!!error}
          placeholder={def.placeholder}
          autoFocus
          onChange={(v) => {
            const { handle, error } = normalizeToHandle(v, def.prefix);
            edit.setDraft(handle);
            setError(error);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") cancel();
          }}
          className="w-52 bg-bg-raised"
          inputClassName="text-xs"
        />
        <button type="button" onClick={commit} disabled={edit.saving || !!error} aria-label="Save"
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
      <p className={`pl-1 text-xs ${error ? "text-danger" : "text-text-subtle"}`}>
        {error ?? "Paste the full link or just the handle"}
      </p>
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
