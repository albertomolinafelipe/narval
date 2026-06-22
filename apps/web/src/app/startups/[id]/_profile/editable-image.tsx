"use client";

import { useRef, useState, type ReactNode } from "react";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import ImageCropperModal from "@/app/_components/shared/image-cropper-modal";
import type { StartupImageKind } from "@/lib/api/client";
import { useProfileEdit } from "./edit-context";

interface EditableImageProps {
  kind: StartupImageKind;
  /** Whether an image currently exists — gates the Delete button. */
  hasImage: boolean;
  /** Crop aspect ratio (1 for a square logo, 16/4 for a banner). */
  aspect: number;
  cropShape?: "rect" | "round";
  /** Border-radius classes matching the underlying image (e.g. "rounded-full"). */
  rounded?: string;
  /** Classes for the wrapper — should size to the underlying image. */
  className?: string;
  /** The rendered image (or placeholder) shown underneath the overlay. */
  children: ReactNode;
}

/**
 * Owner-only hover overlay for an editable profile image. Non-owners see the
 * image untouched. On hover the owner gets a blurred scrim with Change / Delete
 * actions; Change opens the file picker → crop modal → upload. Generic over the
 * image kind so logo and banner (and any future profile image) share one flow.
 */
export function EditableImage({
  kind,
  hasImage,
  aspect,
  cropShape = "rect",
  rounded = "rounded-lg",
  className,
  children,
}: EditableImageProps) {
  const { isOwner, uploadImage, removeImage } = useProfileEdit();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      await uploadImage(kind, blob);
      closeCropper();
    } catch {
      // context toasts the error; keep the cropper open to retry.
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await removeImage(kind);
    } catch {
      // context toasts the error.
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
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
              <button
                type="button"
                onClick={pickFile}
                aria-label={hasImage ? `Change ${kind}` : `Add ${kind}`}
                title={hasImage ? "Change" : "Add"}
                className="flex items-center justify-center rounded-full bg-white/90 p-1.5 text-black transition hover:bg-white"
              >
                <Pencil size={15} />
              </button>
              {hasImage && (
                <button
                  type="button"
                  onClick={onDelete}
                  aria-label={`Remove ${kind}`}
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
          title={`Crop ${kind}`}
          onComplete={onCropComplete}
          onCancel={closeCropper}
        />
      )}
    </>
  );
}
