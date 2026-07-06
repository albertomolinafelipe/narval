"use client";

import { useRef, useState, type ReactNode } from "react";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import ImageCropperModal from "@/app/_components/shared/image-cropper-modal";
import type { StartupImageKind } from "@/lib/api/use-startups-query";
import { useProfileEdit } from "./edit-context";

interface EditableImageProps {
  /** Image kind for the default context-driven upload/delete (logo/banner). */
  kind?: StartupImageKind;
  /** Noun used in aria labels when no kind is given (e.g. "screenshot"). */
  label?: string;
  /** Whether an image currently exists — gates the Delete button. */
  hasImage: boolean;
  /** Crop aspect ratio (1 for a square logo, 16/4 for a banner). */
  aspect: number;
  cropShape?: "rect" | "round";
  /** Border-radius classes matching the underlying image (e.g. "rounded-full"). */
  rounded?: string;
  /** Classes for the wrapper — should size to the underlying image. */
  className?: string;
  /** Hide the Change (pencil) action and its picker — delete-only overlay. */
  showChange?: boolean;
  /** Override the upload flow (default: context uploadImage for `kind`). */
  onUpload?: (blob: Blob) => Promise<void> | void;
  /** Override the delete flow (default: context removeImage for `kind`). */
  onDelete?: () => Promise<void> | void;
  /** The rendered image (or placeholder) shown underneath the overlay. */
  children: ReactNode;
}

/**
 * Owner-only hover overlay for an editable image. Non-owners see the image
 * untouched. On hover the owner gets a blurred scrim with Change / Delete
 * actions; Change opens the file picker → crop modal → upload. Used for logo and
 * banner (context-driven via `kind`), and for gallery shots (delete-only via
 * `showChange={false}` + an `onDelete` override).
 */
export function EditableImage({
  kind,
  label,
  hasImage,
  aspect,
  cropShape = "rect",
  rounded = "rounded-lg",
  className,
  showChange = true,
  onUpload,
  onDelete,
  children,
}: EditableImageProps) {
  const { isOwner, uploadImage, removeImage } = useProfileEdit();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const noun = kind ?? label ?? "image";

  const wrapperClass = `relative overflow-hidden ${rounded} ${className ?? ""}`;

  // Viewers (and SSR before auth resolves) get the plain image — same wrapper so
  // layout (margins, radius, sizing) is identical to the owner's.
  if (!isOwner) return <div className={wrapperClass}>{children}</div>;

  const pickFile = () => inputRef.current?.click();

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
      if (onUpload) await onUpload(blob);
      else if (kind) await uploadImage(kind, blob);
      closeCropper();
    } catch {
      // context toasts the error; keep the cropper open to retry.
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      if (onDelete) await onDelete();
      else if (kind) await removeImage(kind);
    } catch {
      // context toasts the error.
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {showChange && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
      )}
      <div className={`group ${wrapperClass}`}>
        {children}

        {/* Hover scrim + actions. Always rendered for the owner; revealed on hover
            (or while busy) so the spinner stays visible during the request.
            Icon-only buttons so they fit even on a small logo. */}
        <div
          className={`absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 backdrop-blur-sm transition-opacity ${
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin text-white" />
          ) : (
            <>
              {showChange && (
                <button
                  type="button"
                  onClick={pickFile}
                  aria-label={hasImage ? `Change ${noun}` : `Add ${noun}`}
                  title={hasImage ? "Change" : "Add"}
                  className="flex items-center justify-center rounded-full bg-white/90 p-1.5 text-black transition hover:bg-white"
                >
                  <Pencil size={15} />
                </button>
              )}
              {hasImage && (
                <button
                  type="button"
                  onClick={handleDelete}
                  aria-label={`Remove ${noun}`}
                  title="Remove"
                  className="flex items-center justify-center rounded-full bg-white/90 p-1.5 text-danger transition hover:bg-white"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {cropSrc && (
        <ImageCropperModal
          imageSrc={cropSrc}
          aspect={aspect}
          cropShape={cropShape}
          title={`Crop ${noun}`}
          onComplete={onCropComplete}
          onCancel={closeCropper}
        />
      )}
    </>
  );
}
