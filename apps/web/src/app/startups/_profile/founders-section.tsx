"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, Loader2, X } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import ImageCropperModal from "@/app/_components/shared/image-cropper-modal";
import PrefixInput from "@/app/_components/shared/prefix-input";
import { normalizeToHandle } from "@/lib/startup/social-input";
import { uploadFounderPhoto } from "@/lib/api/client";
import { components } from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import { Section } from "./ui";
import { useProfileEdit } from "./edit-context";

type Founder = components["schemas"]["Founder"];
type Startup = components["schemas"]["Startup"];

const MAX_FOUNDERS = 5;

const LINKEDIN_PREFIX = "https://linkedin.com/in/";

function linkedinHref(value: string): string {
  return value.startsWith("http") ? value : LINKEDIN_PREFIX + value;
}

/** 3:4 portrait photo with initial fallback. */
function Photo({ name, url }: { name: string; url?: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-bg-subtle" style={{ aspectRatio: "3/4" }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-3xl font-semibold text-brand">
          {name.charAt(0).toUpperCase() || "?"}
        </span>
      )}
    </div>
  );
}

/** Owner-only photo overlay: hover → blur + pencil/trash → pick → crop 3:4 → upload. */
function EditablePhoto({
  startupId,
  name,
  url,
  onChange,
}: {
  startupId: string;
  name: string;
  url?: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setCropSrc(URL.createObjectURL(file));
  };

  const closeCropper = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const onCropComplete = async (blob: Blob) => {
    setBusy(true);
    try {
      const next = await uploadFounderPhoto(startupId, blob);
      onChange(next);
      closeCropper();
    } catch {
      // keep cropper open to retry
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
      <div className="group relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "3/4" }}>
        <Photo name={name} url={url} />
        <div
          className={`absolute inset-0 flex items-center justify-center gap-2 bg-black/25 transition-opacity md:bg-black/40 md:backdrop-blur-sm ${
            busy ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
          }`}
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin text-white" />
          ) : (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                aria-label={url ? "Change photo" : "Add photo"}
                className="flex items-center justify-center rounded-full bg-white/90 p-1.5 text-black transition hover:bg-white"
              >
                <Pencil size={15} />
              </button>
              {url && (
                <button
                  type="button"
                  onClick={() => onChange("")}
                  aria-label="Remove photo"
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
          aspect={3 / 4}
          cropShape="rect"
          title="Crop photo"
          onComplete={onCropComplete}
          onCancel={closeCropper}
        />
      )}
    </>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-bg px-2 py-1 text-sm text-text outline-none focus:border-brand";

export function FoundersSection({ startup }: { startup: Startup }) {
  const { isOwner, save } = useProfileEdit();
  const savedJson = JSON.stringify(startup.founders ?? []);

  const [draft, setDraft] = useState<Founder[]>(() => JSON.parse(savedJson));
  const [saving, setSaving] = useState(false);
  const [focusedRow, setFocusedRow] = useState<number | null>(null);

  useEffect(() => {
    setDraft(JSON.parse(savedJson));
  }, [savedJson]);

  // Viewer: read-only grid.
  if (!isOwner) {
    const founders: Founder[] = JSON.parse(savedJson);
    if (founders.length === 0) return null;
    return (
      <Section title="Founders">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fill,minmax(100px,130px))]">
          {founders.map((f, i) => (
            <div key={i} className="flex min-w-0 flex-col gap-2">
              <Photo name={f.name} url={f.photo_url} />
              <div>
                <p className="break-words text-sm font-medium text-text">{f.name}</p>
                {f.linkedin && (
                  <a
                    href={linkedinHref(f.linkedin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-text-muted transition hover:text-text"
                  >
                    <SiLinkedin size={12} /> LinkedIn
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>
    );
  }

  // Owner: inline draft editor.
  const cleaned = draft
    .map((f) => ({ ...f, name: f.name.trim() }))
    .filter((f) => f.name);
  const dirty = JSON.stringify(cleaned) !== savedJson;
  const atLimit = draft.length >= MAX_FOUNDERS;
  const hasLinkErrors = draft.some(
    (f) => normalizeToHandle(f.linkedin ?? "", LINKEDIN_PREFIX).error,
  );

  const setRow = (i: number, patch: Partial<Founder>) =>
    setDraft((d) => d.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const addRow = () => {
    if (atLimit) return;
    setDraft((d) => [...d, { name: "", linkedin: "", photo_url: "" }]);
  };
  const removeRow = (i: number) =>
    setDraft((d) => d.filter((_, j) => j !== i));

  const onSave = async () => {
    setSaving(true);
    try {
      await save({ founders: JSON.stringify(cleaned) });
    } catch {
      // context toasts error; keep draft for retry
    } finally {
      setSaving(false);
    }
  };
  const onCancel = () => setDraft(JSON.parse(savedJson));

  return (
    <Section title="Founders">
      <div className="grid grid-cols-2 gap-5 md:grid-cols-[repeat(auto-fill,minmax(160px,200px))]">
        {draft.map((f, i) => (
          <div key={i} className="flex min-w-0 flex-col gap-2">
            <div className="relative">
              <EditablePhoto
                startupId={startup.id}
                name={f.name}
                url={f.photo_url}
                onChange={(url) => setRow(i, { photo_url: url })}
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label="Remove founder"
                className="absolute right-1.5 top-1.5 z-10 flex items-center justify-center rounded-full bg-black/50 p-1 text-white transition hover:bg-danger"
              >
                <X size={13} />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <input
                value={f.name}
                placeholder="Founder name"
                onChange={(e) => setRow(i, { name: e.target.value })}
                className={inputClass}
              />
              {(() => {
                const { handle, error } = normalizeToHandle(
                  f.linkedin ?? "",
                  LINKEDIN_PREFIX,
                );
                return (
                  <>
                    <PrefixInput
                      prefix="linkedin.com/in/"
                      value={handle}
                      invalid={!!error}
                      placeholder="handle"
                      onFocus={() => setFocusedRow(i)}
                      onBlur={() => setFocusedRow(null)}
                      onChange={(v) => {
                        const next = normalizeToHandle(v, LINKEDIN_PREFIX);
                        setRow(i, {
                          linkedin: next.error
                            ? v
                            : next.handle
                              ? LINKEDIN_PREFIX + next.handle
                              : "",
                        });
                      }}
                    />
                    {error ? (
                      <p className="text-xs text-danger">{error}</p>
                    ) : focusedRow === i ? (
                      <p className="text-xs text-text-subtle">
                        Paste the link or just the handle
                      </p>
                    ) : null}
                  </>
                );
              })()}
            </div>
          </div>
        ))}

        {/* Add card — shown when under limit */}
        {!atLimit && (
          <button
            type="button"
            onClick={addRow}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-text-subtle transition hover:border-brand hover:text-text"
            style={{ aspectRatio: "3/4" }}
          >
            <Plus size={20} />
            <span className="text-xs">Add founder</span>
          </button>
        )}
      </div>

      {dirty && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving || hasLinkErrors}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </Button>
        </div>
      )}
    </Section>
  );
}
