"use client";

import { useRef, useState } from "react";
import { Plus, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import ImageCropperModal from "@/app/_components/shared/image-cropper-modal";
import { uploadScreenshot } from "@/lib/api/client";
import { components } from "@/lib/api/generated";
import { Section } from "./ui";
import { EditableImage } from "./editable-image";
import { useProfileEdit } from "./edit-context";

type Startup = components["schemas"]["Startup"];

const MAX_SCREENSHOTS = 4;
/** Vertical, app-store style. Matches the 9:16 crop the cropper enforces. */
const ASPECT = 9 / 16;
/** Display width of each portrait shot (height derives from ASPECT). */
const SHOT_WIDTH = 150;

/** Parse the gallery JSON array, tolerating empty / malformed values. */
function parseGallery(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((u): u is string => typeof u === "string")
      : [];
  } catch {
    return [];
  }
}

/** A single 9:16 screenshot frame. */
function Frame({ url }: { url: string }) {
  return (
    <div
      className="border border-border bg-bg-subtle"
      style={{ width: SHOT_WIDTH, aspectRatio: "9/16" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Product screenshot" className="h-full w-full object-cover" />
    </div>
  );
}

/**
 * Product screenshots gallery for the Product tab. Visitors see a row of
 * vertical screenshots (nothing when empty). The owner gets add (pick → crop
 * 9:16 → upload), delete and reorder; each change saves immediately by writing
 * the URL array back to the startup's gallery JSON field. Capped at 4.
 */
export function GallerySection({ startup }: { startup: Startup }) {
  const { isOwner, save } = useProfileEdit();
  const urls = parseGallery(startup.gallery);

  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Viewer: read-only row, hidden when empty.
  if (!isOwner) {
    if (urls.length === 0) return null;
    return (
      <Section title="Screenshots">
        <div className="flex gap-4 overflow-x-auto pb-2">
          {urls.map((url, i) => (
            <div key={i} className="overflow-hidden rounded-xl">
              <Frame url={url} />
            </div>
          ))}
        </div>
      </Section>
    );
  }

  const atLimit = urls.length >= MAX_SCREENSHOTS;

  const persist = async (next: string[]) => {
    setBusy(true);
    try {
      await save({ gallery: JSON.stringify(next) });
    } catch {
      // context toasts the error.
    } finally {
      setBusy(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (file) setCropSrc(URL.createObjectURL(file));
  };

  const closeCropper = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const onCropComplete = async (blob: Blob) => {
    setBusy(true);
    try {
      const url = await uploadScreenshot(startup.id, blob);
      await save({ gallery: JSON.stringify([...urls, url]) });
      closeCropper();
    } catch {
      // client/context toasts the error; keep the cropper open to retry.
    } finally {
      setBusy(false);
    }
  };

  const removeAt = (i: number) => persist(urls.filter((_, j) => j !== i));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= urls.length) return;
    const next = [...urls];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return persist(next);
  };

  return (
    <Section title="Screenshots">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
      <div className="flex flex-wrap gap-4">
        {urls.map((url, i) => (
          <div key={i} className="group relative" style={{ width: SHOT_WIDTH }}>
            <EditableImage
              label="screenshot"
              hasImage
              aspect={ASPECT}
              rounded="rounded-xl"
              showChange={false}
              onDelete={() => removeAt(i)}
            >
              <Frame url={url} />
            </EditableImage>

            {/* Reorder controls — revealed on hover, layered above the scrim. */}
            <div className="pointer-events-none absolute inset-x-1.5 top-1/2 z-20 flex -translate-y-1/2 justify-between opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={busy || i === 0}
                aria-label="Move left"
                className="pointer-events-auto flex items-center justify-center rounded-full bg-white/90 p-1 text-black transition hover:bg-white disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={busy || i === urls.length - 1}
                aria-label="Move right"
                className="pointer-events-auto flex items-center justify-center rounded-full bg-white/90 p-1 text-black transition hover:bg-white disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}

        {!atLimit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-text-subtle transition hover:border-brand hover:text-text disabled:opacity-50"
            style={{ width: SHOT_WIDTH, aspectRatio: "9/16" }}
          >
            {busy ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Plus size={20} />
                <span className="text-xs">Add screenshot</span>
              </>
            )}
          </button>
        )}
      </div>

      {cropSrc && (
        <ImageCropperModal
          imageSrc={cropSrc}
          aspect={ASPECT}
          cropShape="rect"
          title="Crop screenshot"
          onComplete={onCropComplete}
          onCancel={closeCropper}
        />
      )}
    </Section>
  );
}
