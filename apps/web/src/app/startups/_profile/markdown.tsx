"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil, Check, X } from "lucide-react";
import { components } from "@/lib/api/generated";
import { useProfileEdit } from "./edit-context";
import { useInlineEdit, type StringField } from "./editable";

type UpdateStartupRequest = components["schemas"]["UpdateStartupRequest"];

/** Owner-only nudge linking to a markdown cheatsheet. Renders nothing for visitors. */
export function MarkdownHelp() {
  const { isOwner } = useProfileEdit();
  if (!isOwner) return null;
  return (
    <p className="mb-2 text-xs text-text-subtle">
      You can use Markdown to format the text.{" "}
      <a
        href="https://www.markdownguide.org/cheat-sheet/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand hover:underline"
      >
        Learn how →
      </a>
    </p>
  );
}

/** Renders user-authored markdown safely (no raw HTML) with themed elements. */
export function MarkdownView({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed text-text-muted">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => (
            <h1
              className="mb-2 mt-4 text-base font-semibold text-text first:mt-0"
              {...p}
            />
          ),
          h2: (p) => (
            <h2
              className="mb-2 mt-4 text-sm font-semibold text-text first:mt-0"
              {...p}
            />
          ),
          h3: (p) => (
            <h3
              className="mb-1 mt-3 text-sm font-semibold text-text first:mt-0"
              {...p}
            />
          ),
          p: (p) => <p className="mb-2 last:mb-0" {...p} />,
          a: (p) => (
            <a
              className="text-brand hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              {...p}
            />
          ),
          ul: (p) => <ul className="mb-2 list-disc pl-5" {...p} />,
          ol: (p) => <ol className="mb-2 list-decimal pl-5" {...p} />,
          li: (p) => <li className="mb-0.5" {...p} />,
          strong: (p) => <strong className="font-semibold text-text" {...p} />,
          blockquote: (p) => (
            <blockquote
              className="mb-2 border-l-2 border-border pl-3 italic"
              {...p}
            />
          ),
          code: (p) => (
            <code
              className="rounded bg-bg-subtle px-1 py-0.5 font-mono text-xs"
              {...p}
            />
          ),
          pre: (p) => (
            <pre
              className="mb-2 overflow-x-auto rounded-lg bg-bg-subtle p-3 text-xs"
              {...p}
            />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

interface EditableMarkdownProps {
  field: StringField;
  value: string;
  placeholder?: string;
  maxLength?: number;
}

/**
 * Block-level markdown editor: renders the markdown, with an owner-only pencil
 * that swaps in a raw-markdown textarea. Saves the whole field on confirm.
 */
export function EditableMarkdown({
  field,
  value,
  placeholder = "Add…",
  maxLength,
}: EditableMarkdownProps) {
  const { isOwner, save } = useProfileEdit();
  const edit = useInlineEdit(value, (next) =>
    save({ [field]: next } as UpdateStartupRequest),
  );

  if (!edit.editing) {
    if (!isOwner) {
      return value ? <MarkdownView text={value} /> : null;
    }
    return (
      <div className="group relative">
        {value ? (
          <MarkdownView text={value} />
        ) : (
          <p className="whitespace-pre-line text-sm text-text-subtle">
            {placeholder}
          </p>
        )}
        <button
          type="button"
          onClick={edit.start}
          aria-label="Edit"
          className="absolute right-0 top-0 rounded p-1 text-brand transition hover:bg-bg-subtle hover:text-text-subtle"
        >
          <Pencil size={15} />
        </button>
      </div>
    );
  }

  const commit = () => edit.commit(edit.draft.trim());

  return (
    <div className="flex flex-col gap-1">
      <textarea
        autoFocus
        rows={10}
        value={edit.draft}
        disabled={edit.saving}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => edit.setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") edit.cancel();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs text-text outline-none focus:border-brand"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-subtle">
          Markdown supported
          {maxLength != null && ` · ${edit.draft.length}/${maxLength}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={commit}
            disabled={edit.saving}
            aria-label="Save"
            className="rounded p-1 text-success transition hover:bg-success/10 disabled:opacity-50"
          >
            <Check size={18} />
          </button>
          <button
            type="button"
            onClick={edit.cancel}
            disabled={edit.saving}
            aria-label="Cancel"
            className="rounded p-1 text-danger transition hover:bg-danger/10 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
