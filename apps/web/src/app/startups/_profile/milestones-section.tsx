"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  Banknote,
  Check,
  Link2,
  Loader2,
  Package,
  Plus,
  Rocket,
  TrendingUp,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { components } from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Section } from "./ui";
import { useProfileEdit } from "./edit-context";

type Startup = components["schemas"]["Startup"];

type MilestoneCategory =
  "launch" | "funding" | "product" | "team" | "growth" | "award";

interface Milestone {
  text: string;
  link?: string;
  category: MilestoneCategory;
}

interface MilestoneData {
  items: Milestone[];
  /** Count of leading milestones marked accomplished (0…items.length). */
  achieved: number;
}

const MAX_MILESTONES = 50;
const MAX_TEXT = 100;
/** Show the remaining-chars counter once within this many chars of the cap. */
const TEXT_COUNTER_THRESHOLD = 20;
/** Width of one timeline column (rem); the connector line insets by half this so it spans circle centers. */
const TIMELINE_ITEM_REM = 10;
/** Trim the empty half-slot before the first circle and after the last one. */
const TIMELINE_EDGE_TRIM_REM = 1.5;

type Icon = ComponentType<{ size?: number; className?: string }>;

const CATEGORIES: { value: MilestoneCategory; label: string; Icon: Icon }[] = [
  { value: "launch", label: "Launch", Icon: Rocket },
  { value: "funding", label: "Funding", Icon: Banknote },
  { value: "product", label: "Product", Icon: Package },
  { value: "team", label: "Team", Icon: Users },
  { value: "growth", label: "Growth", Icon: TrendingUp },
  { value: "award", label: "Award", Icon: Trophy },
];

function categoryIcon(category: MilestoneCategory): Icon {
  return CATEGORIES.find((c) => c.value === category)?.Icon ?? Trophy;
}

/** Parse the stored JSON blob; tolerate empty/legacy/garbage. */
function parseMilestones(raw?: string): MilestoneData {
  if (!raw) return { items: [], achieved: 0 };
  try {
    const data = JSON.parse(raw);
    const items: Milestone[] = Array.isArray(data?.items) ? data.items : [];
    const achieved = Math.max(
      0,
      Math.min(items.length, Number(data?.achieved) || 0),
    );
    return { items, achieved };
  } catch {
    return { items: [], achieved: 0 };
  }
}

/** Normalize for save + dirty comparison: trim text, drop empties, clamp achieved. */
function clean(data: MilestoneData): MilestoneData {
  const items = data.items
    .map((m) => ({
      text: m.text.trim(),
      link: m.link?.trim() || undefined,
      category: m.category,
    }))
    .filter((m) => m.text);
  return {
    items,
    achieved: Math.max(0, Math.min(items.length, data.achieved)),
  };
}

const inputClass =
  "w-full rounded-lg border border-border bg-bg px-2 py-1 text-sm text-text outline-none focus:border-brand";

export function MilestonesSection({ startup }: { startup: Startup }) {
  const { isOwner, save } = useProfileEdit();
  const savedJson = JSON.stringify(parseMilestones(startup.milestones));

  const [draft, setDraft] = useState<MilestoneData>(() =>
    JSON.parse(savedJson),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(JSON.parse(savedJson));
  }, [savedJson]);

  // Viewer: read-only timeline.
  if (!isOwner) {
    const data: MilestoneData = JSON.parse(savedJson);
    if (data.items.length === 0) return null;
    return (
      <Section title="Milestones">
        <Timeline data={data} />
      </Section>
    );
  }

  // Owner: inline draft editor.
  const cleaned = clean(draft);
  const dirty = JSON.stringify(cleaned) !== savedJson;
  const atLimit = draft.items.length >= MAX_MILESTONES;

  const setItem = (i: number, patch: Partial<Milestone>) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    }));
  const addItem = () => {
    if (atLimit) return;
    setDraft((d) => ({
      ...d,
      items: [...d.items, { text: "", link: "", category: "launch" }],
    }));
  };
  const removeItem = (i: number) =>
    setDraft((d) => ({
      items: d.items.filter((_, j) => j !== i),
      // Items above the removed one shift down; keep the frontier consistent.
      achieved: i < d.achieved ? d.achieved - 1 : d.achieved,
    }));
  // Click a row's marker → move the "accomplished up to here" frontier.
  const toggleAchieved = (i: number) =>
    setDraft((d) => ({ ...d, achieved: d.achieved === i + 1 ? i : i + 1 }));

  const onSave = async () => {
    setSaving(true);
    try {
      await save({ milestones: JSON.stringify(cleaned) });
    } catch {
      // context toasts error; keep draft for retry
    } finally {
      setSaving(false);
    }
  };
  const onCancel = () => setDraft(JSON.parse(savedJson));

  return (
    <Section title="Milestones">
      <div className="flex flex-col gap-2">
        {draft.items.map((m, i) => {
          const done = i < draft.achieved;
          return (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-border bg-bg-subtle/30 p-2"
            >
              {/* Top row: marker, category, link, remove */}
              <div className="flex items-center gap-2">
                {/* Accomplished marker */}
                <button
                  type="button"
                  onClick={() => toggleAchieved(i)}
                  aria-label={
                    done
                      ? "Mark not accomplished"
                      : "Mark accomplished up to here"
                  }
                  title="Accomplished up to here"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    done
                      ? "border-brand bg-brand text-white opacity-80"
                      : "border-border text-text-subtle hover:border-brand"
                  }`}
                >
                  {done && <Check size={16} strokeWidth={3} />}
                </button>

                {/* Category */}
                <Select
                  value={m.category}
                  onValueChange={(val) =>
                    setItem(i, { category: val as MilestoneCategory })
                  }
                >
                  <SelectTrigger className="w-32 shrink-0">
                    {(() => {
                      const cat = CATEGORIES.find(
                        (c) => c.value === m.category,
                      );
                      const Icon = cat?.Icon ?? Trophy;
                      return (
                        <span className="flex items-center gap-1.5">
                          <Icon size={13} className="shrink-0 text-brand" />
                          <span>{cat?.label ?? m.category}</span>
                        </span>
                      );
                    })()}
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-1.5">
                          <c.Icon size={13} className="shrink-0" />
                          {c.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Link */}
                <div className="relative min-w-0 flex-1">
                  <Link2
                    size={13}
                    className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-subtle"
                  />
                  <input
                    value={m.link ?? ""}
                    placeholder="Link"
                    onChange={(e) => setItem(i, { link: e.target.value })}
                    className={`${inputClass} w-full pl-7`}
                  />
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  aria-label="Remove milestone"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-text-subtle transition hover:bg-danger/10 hover:text-danger"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Text — full width below */}
              <div className="relative">
                <input
                  value={m.text}
                  placeholder="Milestone (e.g. Launched MVP)"
                  onChange={(e) => setItem(i, { text: e.target.value })}
                  className={`${inputClass} w-full pr-9`}
                  maxLength={MAX_TEXT}
                />
                {m.text.length > MAX_TEXT - TEXT_COUNTER_THRESHOLD && (
                  <span
                    className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs ${m.text.length >= MAX_TEXT ? "text-danger" : "text-text-subtle"}`}
                  >
                    {MAX_TEXT - m.text.length}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {!atLimit && (
          <button
            type="button"
            onClick={addItem}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-sm text-text-subtle transition hover:border-brand hover:text-text"
          >
            <Plus size={16} /> Add milestone
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

/** Read-only horizontal scrollable timeline. */
function Timeline({ data }: { data: MilestoneData }) {
  return (
    <div className="w-fit max-w-full pt-2">
      <ScrollArea className="w-full pb-5">
        <div className="relative inline-flex">
          {/* Connector line: from center of first circle to center of last */}
          <div
            className="absolute top-4 h-px bg-border"
            style={{
              left: `${TIMELINE_ITEM_REM / 2 - TIMELINE_EDGE_TRIM_REM}rem`,
              right: `${TIMELINE_ITEM_REM / 2 - TIMELINE_EDGE_TRIM_REM}rem`,
            }}
          />

          <ol className="relative flex items-start">
            {data.items.map((m, i) => {
              const done = i < data.achieved;
              const isFirst = i === 0;
              const isLast = i === data.items.length - 1;
              const Icon = categoryIcon(m.category);
              const href = m.link
                ? m.link.startsWith("http")
                  ? m.link
                  : `https://${m.link}`
                : null;

              return (
                <li
                  key={i}
                  style={{
                    width: `${TIMELINE_ITEM_REM}rem`,
                    marginLeft: isFirst
                      ? `-${TIMELINE_EDGE_TRIM_REM}rem`
                      : undefined,
                    marginRight: isLast
                      ? `-${TIMELINE_EDGE_TRIM_REM}rem`
                      : undefined,
                  }}
                  className="flex shrink-0 flex-col items-center gap-2 pb-3"
                >
                  {/* Circle */}
                  <span
                    className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                      done
                        ? "border-brand bg-brand text-white"
                        : "border-border bg-bg text-text-muted"
                    }`}
                  >
                    <Icon size={14} />
                  </span>

                  {/* Label */}
                  <div className="w-full px-1 text-center">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`line-clamp-3 text-xs underline decoration-dotted underline-offset-2 transition hover:text-brand ${
                          done ? "text-text" : "text-text-muted"
                        }`}
                      >
                        {m.text}
                      </a>
                    ) : (
                      <span
                        className={`line-clamp-3 text-xs ${done ? "text-text" : "text-text-muted"}`}
                      >
                        {m.text}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </ScrollArea>
    </div>
  );
}
