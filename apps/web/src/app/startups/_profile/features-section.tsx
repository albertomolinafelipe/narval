"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import type { Startup } from "@/lib/api/gen";
import { Button } from "@/components/ui/button";
import { Section } from "./ui";
import { useProfileEdit } from "./edit-context";

interface Feature {
  title: string;
  description?: string;
}

const MAX_FEATURES = 4;
const MAX_TITLE = 30;
const MAX_DESC = 70;

/** Parse the stored JSON array; tolerate empty/legacy/garbage. */
function parseFeatures(raw?: string): Feature[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .map((f) => ({
        title: typeof f?.title === "string" ? f.title : "",
        description:
          typeof f?.description === "string" ? f.description : undefined,
      }))
      .filter((f) => f.title || f.description);
  } catch {
    return [];
  }
}

/** Normalize for save + dirty comparison: trim, drop empty-title rows. */
function clean(items: Feature[]): Feature[] {
  return items
    .map((f) => ({
      title: f.title.trim(),
      description: f.description?.trim() || undefined,
    }))
    .filter((f) => f.title);
}

const inputClass =
  "w-full rounded-lg border border-border bg-bg px-2 py-1 text-sm text-text outline-none focus:border-brand";

export function FeaturesSection({ startup }: { startup: Startup }) {
  const { isOwner, save } = useProfileEdit();
  const savedJson = JSON.stringify(parseFeatures(startup.features));

  const [draft, setDraft] = useState<Feature[]>(() => JSON.parse(savedJson));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(JSON.parse(savedJson));
  }, [savedJson]);

  // Viewer: read-only grid, hidden when empty.
  if (!isOwner) {
    const items: Feature[] = JSON.parse(savedJson);
    if (items.length === 0) return null;
    return (
      <Section title="Features">
        <FeatureList items={items} />
      </Section>
    );
  }

  // Owner: inline draft editor.
  const cleaned = clean(draft);
  const dirty = JSON.stringify(cleaned) !== savedJson;
  const atLimit = draft.length >= MAX_FEATURES;

  const setItem = (i: number, patch: Partial<Feature>) =>
    setDraft((d) => d.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const addItem = () => {
    if (atLimit) return;
    setDraft((d) => [...d, { title: "", description: "" }]);
  };
  const removeItem = (i: number) =>
    setDraft((d) => d.filter((_, j) => j !== i));

  const onSave = async () => {
    setSaving(true);
    try {
      await save({ features: JSON.stringify(cleaned) });
    } catch {
      // context toasts error; keep draft for retry
    } finally {
      setSaving(false);
    }
  };
  const onCancel = () => setDraft(JSON.parse(savedJson));

  return (
    <Section title="Features">
      <div className="flex flex-col gap-2">
        {draft.map((f, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg border border-border bg-bg-subtle/30 p-2"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <input
                value={f.title}
                placeholder="Feature (e.g. Real-time collaboration)"
                onChange={(e) => setItem(i, { title: e.target.value })}
                className={inputClass}
                maxLength={MAX_TITLE}
              />
              <input
                value={f.description ?? ""}
                placeholder="Short description (optional)"
                onChange={(e) => setItem(i, { description: e.target.value })}
                className={`${inputClass} text-text-muted`}
                maxLength={MAX_DESC}
              />
            </div>

            <button
              type="button"
              onClick={() => removeItem(i)}
              aria-label="Remove feature"
              className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-text-subtle transition hover:bg-danger/10 hover:text-danger"
            >
              <X size={15} />
            </button>
          </div>
        ))}

        {!atLimit && (
          <button
            type="button"
            onClick={addItem}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-sm text-text-subtle transition hover:border-brand hover:text-text"
          >
            <Plus size={16} /> Add feature
          </button>
        )}
      </div>

      {dirty && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </Button>
        </div>
      )}
    </Section>
  );
}

/** Read-only feature list — single column, no per-item card. */
function FeatureList({ items }: { items: Feature[] }) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((f, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text">{f.title}</p>
            {f.description && (
              <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                {f.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
