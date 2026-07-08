"use client";

import { type ComponentType, createElement } from "react";
import { GitBranch, Pencil, Check, X } from "lucide-react";
import { SiGithub, SiGitlab, SiBitbucket, SiHuggingface } from "react-icons/si";
import { components } from "@/lib/api/generated";
import { useProfileEdit } from "./edit-context";
import { useInlineEdit } from "./editable";

type UpdateStartupRequest = components["schemas"]["UpdateStartupRequest"];

type Icon = ComponentType<{ size?: number; className?: string }>;

// Known code/model hosts → branded icon. Anything else falls back to GitBranch.
const PROVIDERS: { match: string; Icon: Icon }[] = [
  { match: "github.com", Icon: SiGithub },
  { match: "gitlab.com", Icon: SiGitlab },
  { match: "bitbucket.org", Icon: SiBitbucket },
  { match: "huggingface.co", Icon: SiHuggingface },
];

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
}

function providerIcon(url: string): Icon {
  const host = stripScheme(url).toLowerCase();
  return PROVIDERS.find((p) => host.startsWith(p.match))?.Icon ?? GitBranch;
}

/** A single editable source/repo link (GitHub, GitLab, Hugging Face, …). */
export function EditableSource({ value }: { value: string }) {
  const { isOwner, save } = useProfileEdit();
  const edit = useInlineEdit(value, (next) =>
    save({ github: next.trim() } as UpdateStartupRequest),
  );

  if (!edit.editing) {
    const inner = (
      <>
        {createElement(providerIcon(value), {
          size: 16,
          className: "shrink-0",
        })}
        <span className="truncate">{stripScheme(value)}</span>
      </>
    );

    if (!isOwner) {
      if (!value) return null;
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-base text-text-muted transition hover:text-text"
        >
          {inner}
        </a>
      );
    }

    return (
      <button
        type="button"
        onClick={edit.start}
        className="group flex items-center gap-2 text-base text-text-muted transition hover:text-text"
      >
        {value ? (
          inner
        ) : (
          <span className="flex items-center gap-2 text-text-subtle">
            <GitBranch size={16} className="shrink-0" />
            Add a repo or source link
          </span>
        )}
        <Pencil
          size={13}
          className="shrink-0 text-text-subtle opacity-0 transition group-hover:opacity-100"
        />
      </button>
    );
  }

  const commit = () => edit.commit(edit.draft.trim());

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={edit.draft}
        disabled={edit.saving}
        placeholder="https://github.com/org/repo"
        onChange={(e) => edit.setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") edit.cancel();
        }}
        className="w-72 rounded-lg border border-border bg-bg px-2 py-1 text-sm text-text outline-none focus:border-brand"
      />
      <button
        type="button"
        onClick={commit}
        disabled={edit.saving}
        aria-label="Save"
        className="shrink-0 rounded p-1 text-success transition hover:bg-success/10 disabled:opacity-50"
      >
        <Check size={18} />
      </button>
      <button
        type="button"
        onClick={edit.cancel}
        disabled={edit.saving}
        aria-label="Cancel"
        className="shrink-0 rounded p-1 text-danger transition hover:bg-danger/10 disabled:opacity-50"
      >
        <X size={18} />
      </button>
    </div>
  );
}
