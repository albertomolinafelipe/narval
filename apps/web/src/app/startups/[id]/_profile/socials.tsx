"use client";

import { useState, type ComponentType } from "react";
import { Plus, Check, X, Pencil } from "lucide-react";
import { SiLinkedin, SiX, SiInstagram } from "react-icons/si";
import { components } from "@/lib/api/generated";
import { useProfileEdit } from "./edit-context";
import { useInlineEdit } from "./editable";

type Startup = components["schemas"]["Startup"];
type UpdateStartupRequest = components["schemas"]["UpdateStartupRequest"];

// Social fields stored as a full URL = prefix + the user-entered suffix.
type SocialField = "linkedin" | "twitter" | "instagram";

interface SocialDef {
  field: SocialField;
  label: string;
  prefix: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  placeholder: string;
}

const SOCIALS: SocialDef[] = [
  {
    field: "linkedin",
    label: "LinkedIn",
    prefix: "https://linkedin.com/company/",
    Icon: SiLinkedin,
    placeholder: "yourcompany",
  },
  {
    field: "twitter",
    label: "X",
    prefix: "https://x.com/",
    Icon: SiX,
    placeholder: "yourhandle",
  },
  {
    field: "instagram",
    label: "Instagram",
    prefix: "https://instagram.com/",
    Icon: SiInstagram,
    placeholder: "yourhandle",
  },
];

function stripPrefix(url: string, prefix: string): string {
  const normalized = url.replace("https://www.", "https://");
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : url;
}

function EditableSocial({
  def,
  value,
  defaultEditing = false,
  onClose,
}: {
  def: SocialDef;
  value: string;
  defaultEditing?: boolean;
  onClose?: () => void;
}) {
  const { isOwner, save } = useProfileEdit();
  const suffix = stripPrefix(value, def.prefix);
  const edit = useInlineEdit(
    suffix,
    (next) =>
      save({
        [def.field]: next.trim() ? def.prefix + next.trim() : "",
      } as UpdateStartupRequest),
    defaultEditing,
  );

  const { Icon } = def;

  if (!edit.editing) {
    const inner = (
      <>
        <Icon size={18} className="shrink-0" />
        <span className="truncate">{suffix}</span>
      </>
    );

    // Viewer: plain link, nothing when empty.
    if (!isOwner) {
      if (!value) return null;
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-text-muted transition hover:text-text"
        >
          {inner}
        </a>
      );
    }

    // Owner: click to edit.
    return (
      <button
        type="button"
        onClick={edit.start}
        className="group flex items-center gap-2 text-sm text-text-muted transition hover:text-text"
      >
        {inner}
        <Pencil
          size={13}
          className="shrink-0 text-text-subtle opacity-0 transition group-hover:opacity-100"
        />
      </button>
    );
  }

  const commit = async () => {
    await edit.commit(edit.draft.trim());
    onClose?.();
  };
  const cancel = () => {
    edit.cancel();
    onClose?.();
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex w-52 overflow-hidden rounded-lg border border-border bg-bg-raised focus-within:border-brand">
        <span className="flex shrink-0 items-center border-r border-border bg-bg-subtle px-2 text-xs text-text-subtle">
          {def.prefix.replace("https://", "")}
        </span>
        <input
          autoFocus
          value={edit.draft}
          disabled={edit.saving}
          placeholder={def.placeholder}
          onChange={(e) => edit.setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") cancel();
          }}
          className="min-w-0 flex-1 bg-transparent px-2 py-1 text-xs text-text outline-none placeholder:text-text-subtle"
        />
      </div>
      <button
        type="button"
        onClick={commit}
        disabled={edit.saving}
        aria-label="Save"
        className="shrink-0 rounded p-1 text-success transition hover:bg-success/10 disabled:opacity-50"
      >
        <Check size={16} />
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={edit.saving}
        aria-label="Cancel"
        className="shrink-0 rounded p-1 text-danger transition hover:bg-danger/10 disabled:opacity-50"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function SocialsColumn({ startup }: { startup: Startup }) {
  const { isOwner } = useProfileEdit();
  const [adding, setAdding] = useState<SocialField[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const presentFields = new Set(
    SOCIALS.filter((s) => startup[s.field]).map((s) => s.field),
  );
  const present = SOCIALS.filter((s) => presentFields.has(s.field));
  const addingDefs = SOCIALS.filter(
    (s) => adding.includes(s.field) && !presentFields.has(s.field),
  );
  const missing = SOCIALS.filter(
    (s) => !presentFields.has(s.field) && !adding.includes(s.field),
  );

  if (!isOwner && present.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-col items-start gap-2">
      {present.map((def) => (
        <EditableSocial
          key={def.field}
          def={def}
          value={(startup[def.field] as string) ?? ""}
        />
      ))}
      {addingDefs.map((def) => (
        <EditableSocial
          key={def.field}
          def={def}
          value=""
          defaultEditing
          onClose={() =>
            setAdding((a) => a.filter((f) => f !== def.field))
          }
        />
      ))}
      {isOwner && missing.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1 text-xs text-text-subtle transition hover:text-text"
          >
            <Plus size={14} /> Add
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 rounded-lg border border-border bg-bg p-1 shadow-lg">
              {missing.map((def) => (
                <button
                  key={def.field}
                  type="button"
                  onClick={() => {
                    setAdding((a) => [...a, def.field]);
                    setMenuOpen(false);
                  }}
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
