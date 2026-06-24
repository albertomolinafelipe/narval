"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { SiYoutube } from "react-icons/si";
import { components } from "@/lib/api/generated";
import { useProfileEdit } from "./edit-context";
import { useInlineEdit } from "./editable";

type UpdateStartupRequest = components["schemas"]["UpdateStartupRequest"];

/** Pull the 11-char video id out of any common YouTube URL shape. */
export function youtubeId(url: string): string | null {
  const match = url
    .trim()
    .match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/,
    );
  return match ? match[1] : null;
}

/** 16:9 responsive embed. */
function Embed({ id }: { id: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16/9" }}>
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title="Intro video"
        className="absolute inset-0 h-full w-full"
        allow="accelerated-sensors; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}

/** Owner-editable YouTube embed for the Overview tab. */
export function EditableVideo({ value }: { value: string }) {
  const { isOwner, save } = useProfileEdit();
  const edit = useInlineEdit(value, (next) =>
    save({ video_url: next.trim() } as UpdateStartupRequest),
  );

  const id = youtubeId(value);

  // Editing: URL input.
  if (edit.editing) {
    const commit = () => edit.commit(edit.draft.trim());
    const draftId = youtubeId(edit.draft);
    const invalid = edit.draft.trim().length > 0 && !draftId;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={edit.draft}
            disabled={edit.saving}
            placeholder="https://youtube.com/watch?v=…"
            onChange={(e) => edit.setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !invalid) {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") edit.cancel();
            }}
            className="w-full max-w-md rounded-lg border border-border bg-bg px-2 py-1 text-sm text-text outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={commit}
            disabled={edit.saving || invalid}
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
        {invalid && (
          <p className="text-xs text-danger">Not a recognized YouTube URL.</p>
        )}
        {draftId && (
          <div className="max-w-2xl">
            <Embed id={draftId} />
          </div>
        )}
      </div>
    );
  }

  // Has a valid video.
  if (id) {
    return (
      <div className="group relative max-w-2xl">
        <Embed id={id} />
        {isOwner && (
          <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={edit.start}
              aria-label="Change video"
              className="flex items-center justify-center rounded-full bg-white/90 p-1.5 text-black transition hover:bg-white"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => edit.commit("")}
              aria-label="Remove video"
              className="flex items-center justify-center rounded-full bg-white/90 p-1.5 text-danger transition hover:bg-white"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // No video. Owner sees an add slot; visitors see nothing.
  if (!isOwner) return null;
  return (
    <button
      type="button"
      onClick={edit.start}
      className="flex w-full max-w-2xl flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-text-subtle transition hover:border-brand hover:text-text"
      style={{ aspectRatio: "16/9" }}
    >
      <SiYoutube size={24} />
      <span className="text-sm">Add an intro video</span>
    </button>
  );
}
