"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, Loader2, X } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import ImageCropperModal from "@/app/_components/shared/image-cropper-modal";
import PrefixInput from "@/app/_components/shared/prefix-input";
import { uploadFounderPhoto } from "@/lib/api/client";
import { components } from "@/lib/api/generated";
import { Section } from "./ui";
import { useProfileEdit } from "./edit-context";

type Founder = components["schemas"]["Founder"];
type Startup = components["schemas"]["Startup"];

// LinkedIn is stored as a full URL = prefix + the user-entered handle, matching
// the socials column convention.
const LINKEDIN_PREFIX = "https://linkedin.com/in/";

function linkedinHref(value: string): string {
  return value.startsWith("http") ? value : LINKEDIN_PREFIX + value;
}

function stripLinkedin(value: string): string {
  const normalized = value.replace("https://www.", "https://");
  return normalized.startsWith(LINKEDIN_PREFIX)
    ? normalized.slice(LINKEDIN_PREFIX.length)
    : value;
}

function Photo({ name, url }: { name: string; url?: string }) {
  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-bg-subtle">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-brand">
          {name.charAt(0).toUpperCase() || "?"}
        </span>
      )}
    </div>
  );
}

/** Owner-only founder photo control: hover overlay → pick → crop (1:1) → upload. */
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
      // uploadFounderPhoto throws on failure; keep cropper open to retry.
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
      <div className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
        <Photo name={name} url={url} />
        <div
          className={`absolute inset-0 flex items-center justify-center gap-1 bg-black/40 backdrop-blur-sm transition-opacity ${
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin text-white" />
          ) : (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                aria-label={url ? "Change photo" : "Add photo"}
                className="flex items-center justify-center rounded-full bg-white/90 p-1 text-black transition hover:bg-white"
              >
                <Pencil size={13} />
              </button>
              {url && (
                <button
                  type="button"
                  onClick={() => onChange("")}
                  aria-label="Remove photo"
                  className="flex items-center justify-center rounded-full bg-white/90 p-1 text-danger transition hover:bg-white"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {cropSrc && (
        <ImageCropperModal
          imageSrc={cropSrc}
          aspect={1}
          cropShape="rect"
          title="Crop photo"
          onComplete={onCropComplete}
          onCancel={closeCropper}
        />
      )}
    </>
  );
}

const cardClass =
  "flex items-center gap-3 rounded-xl border border-border bg-bg-raised p-3";
const inputClass =
  "w-full rounded-lg border border-border bg-bg px-2 py-1 text-sm text-text outline-none focus:border-brand";

export function FoundersSection({ startup }: { startup: Startup }) {
  const { isOwner, save } = useProfileEdit();
  const savedJson = JSON.stringify(startup.founders ?? []);

  const [draft, setDraft] = useState<Founder[]>(() => JSON.parse(savedJson));
  const [saving, setSaving] = useState(false);

  // Re-sync the draft whenever the server data changes (including after our own
  // save). Local edits don't change savedJson, so they're preserved.
  useEffect(() => {
    setDraft(JSON.parse(savedJson));
  }, [savedJson]);

  // Viewer: read-only grid, nothing when there are no founders.
  if (!isOwner) {
    const founders: Founder[] = JSON.parse(savedJson);
    if (founders.length === 0) return null;
    return (
      <Section title="Founders">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {founders.map((f, i) => (
            <div key={i} className={cardClass}>
              <Photo name={f.name} url={f.photo_url} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{f.name}</p>
                {f.linkedin && (
                  <a
                    href={linkedinHref(f.linkedin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
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

  // Owner: inline editor over a local draft; a Save/Cancel bar appears when dirty.
  const cleaned = draft
    .map((f) => ({ ...f, name: f.name.trim() }))
    .filter((f) => f.name);
  const dirty = JSON.stringify(cleaned) !== savedJson;

  const setRow = (i: number, patch: Partial<Founder>) =>
    setDraft((d) => d.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const addRow = () =>
    setDraft((d) => [...d, { name: "", linkedin: "", photo_url: "" }]);
  const removeRow = (i: number) =>
    setDraft((d) => d.filter((_, j) => j !== i));

  const onSave = async () => {
    setSaving(true);
    try {
      await save({ founders: JSON.stringify(cleaned) });
    } catch {
      // context toasts the error; keep the draft so the user can retry.
    } finally {
      setSaving(false);
    }
  };
  const onCancel = () => setDraft(JSON.parse(savedJson));

  return (
    <Section title="Founders">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {draft.map((f, i) => (
          <div key={i} className={cardClass}>
            <EditablePhoto
              startupId={startup.id}
              name={f.name}
              url={f.photo_url}
              onChange={(url) => setRow(i, { photo_url: url })}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <input
                value={f.name}
                placeholder="Founder name"
                onChange={(e) => setRow(i, { name: e.target.value })}
                className={inputClass}
              />
              <PrefixInput
                prefix="linkedin.com/in/"
                value={stripLinkedin(f.linkedin ?? "")}
                placeholder="handle"
                onChange={(v) =>
                  setRow(i, {
                    linkedin: v.trim() ? LINKEDIN_PREFIX + v.trim() : "",
                  })
                }
              />
            </div>
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label="Remove founder"
              className="shrink-0 self-start rounded p-1 text-text-subtle transition hover:bg-danger/10 hover:text-danger"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-text-muted transition hover:border-brand hover:text-text"
        >
          <Plus size={16} /> Add founder
        </button>

        {dirty && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg px-3 py-1.5 text-sm text-text-muted transition hover:text-text disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-text transition hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
          </div>
        )}
      </div>
    </Section>
  );
}
