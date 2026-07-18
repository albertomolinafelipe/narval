"use client";

import { useState, type ReactNode } from "react";
import { Check, X, Pencil } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import type { UpdateStartupRequest } from "@/lib/api/gen";
import LocationInput from "@/app/_components/forms/location-input";
import { useProfileEdit } from "./edit-context";

// Keys of the update request whose value matches V — lets each editor accept
// only the fields it can actually drive.
type FieldOf<V> = {
  [K in keyof UpdateStartupRequest]-?: NonNullable<
    UpdateStartupRequest[K]
  > extends V
    ? K
    : never;
}[keyof UpdateStartupRequest];
export type StringField = FieldOf<string>;
type NumberField = FieldOf<number>;

/**
 * Shared edit-state machine for inline editors: draft value, open/close, save.
 * Generic over the value type so every editor reuses it.
 */
export function useInlineEdit<T>(
  value: T,
  onSave: (next: T) => Promise<void> | void,
  startOpen = false,
) {
  const [editing, setEditing] = useState(startOpen);
  const [draft, setDraft] = useState<T>(value);
  const [saving, setSaving] = useState(false);

  const start = () => {
    setDraft(value);
    setEditing(true);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };
  const commit = async (next: T = draft) => {
    if (next === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      // Keep the editor open on failure (validation or network); the editor
      // surfaces its own error. context.save already toasts network errors.
    } finally {
      setSaving(false);
    }
  };

  return { editing, draft, setDraft, saving, start, cancel, commit };
}

/**
 * Presentational shell shared by all editors: owner gate, click-to-edit display
 * with a pencil affordance, and the save / cancel controls. Each editor supplies
 * its own input element.
 */
function EditShell({
  display,
  placeholder,
  placeholderClassName,
  hasValue,
  editing,
  saving,
  input,
  error,
  fill = false,
  block = false,
  onStart,
  onCommit,
  onCancel,
}: {
  display: ReactNode;
  placeholder: string;
  placeholderClassName?: string;
  hasValue: boolean;
  editing: boolean;
  saving: boolean;
  input: ReactNode;
  error?: string | null;
  /** Stretch the editor input to fill the parent's width while editing. */
  fill?: boolean;
  /** Full-width display that wraps (multiline); otherwise the pencil hugs the text. */
  block?: boolean;
  onStart: () => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const { isOwner } = useProfileEdit();

  // Viewers: value only, nothing when empty.
  if (!isOwner) return hasValue ? <>{display}</> : null;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={onStart}
        className={`group items-start rounded text-left ${
          block
            ? "flex w-fit max-w-prose gap-2"
            : "inline-flex max-w-full gap-1"
        }`}
      >
        <span className={block ? "min-w-0 flex-1" : undefined}>
          {hasValue ? (
            display
          ) : (
            <span className={`text-text-subtle ${placeholderClassName ?? ""}`}>
              {placeholder}
            </span>
          )}
        </span>
        <Pencil
          size={15}
          className="mt-1.5 shrink-0 text-text-subtle opacity-0 transition group-hover:text-brand group-hover:opacity-100"
        />
      </button>
    );
  }

  return (
    <span
      className={`flex-col gap-0.5 ${fill ? "flex w-full" : "inline-flex"}`}
    >
      <span className="flex items-start gap-1">
        {input}
        <button
          type="button"
          onClick={onCommit}
          disabled={saving}
          aria-label="Save"
          className="mt-0.5 shrink-0 rounded p-1 text-success transition hover:bg-success/10 disabled:opacity-50"
        >
          <Check size={18} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          aria-label="Cancel"
          className="mt-0.5 shrink-0 rounded p-1 text-danger transition hover:bg-danger/10 disabled:opacity-50"
        >
          <X size={18} />
        </button>
      </span>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

const inputBase =
  "rounded-lg border border-border bg-bg px-2 py-1 outline-none focus:border-brand";

interface EditableTextProps {
  field: StringField;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  /** Hard character cap (enforced in the input) plus a live counter. */
  maxLength?: number;
  /** Tailwind classes applied to both the display element and the input. */
  className?: string;
  /** Custom display renderer (e.g. wrap in a styled element). Defaults to plain text. */
  display?: (value: string) => ReactNode;
}

export function EditableText({
  field,
  value,
  placeholder = "Add…",
  multiline = false,
  maxLength,
  className,
  display,
}: EditableTextProps) {
  const { save } = useProfileEdit();
  const edit = useInlineEdit(value, (next) =>
    save({ [field]: next } as UpdateStartupRequest),
  );

  const commit = () => edit.commit(edit.draft.trim());
  const onKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === "Escape") edit.cancel();
    if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  };

  const shared = {
    autoFocus: true,
    value: edit.draft,
    disabled: edit.saving,
    placeholder,
    maxLength,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      edit.setDraft(e.target.value),
    onKeyDown,
    className: `${inputBase} w-full ${className ?? ""}`,
  };

  const field_ = multiline ? (
    <textarea rows={4} {...shared} />
  ) : (
    <input type="text" {...shared} />
  );

  return (
    <EditShell
      display={
        display ? display(value) : <span className={className}>{value}</span>
      }
      placeholder={placeholder}
      placeholderClassName={className}
      hasValue={value.length > 0}
      editing={edit.editing}
      saving={edit.saving}
      fill
      block={multiline}
      onStart={edit.start}
      onCommit={commit}
      onCancel={edit.cancel}
      input={
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {field_}
          {maxLength != null && (
            <span className="text-right text-xs text-text-subtle">
              {edit.draft.length}/{maxLength}
            </span>
          )}
        </span>
      }
    />
  );
}

interface EditableNumberProps {
  field: NumberField;
  value: number | null | undefined;
  placeholder?: string;
  min?: number;
  max?: number;
  className?: string;
  display?: (value: number) => ReactNode;
}

export function EditableNumber({
  field,
  value,
  placeholder = "Add…",
  min,
  max,
  className,
  display,
}: EditableNumberProps) {
  const { save } = useProfileEdit();
  const [error, setError] = useState<string | null>(null);

  const edit = useInlineEdit(
    value != null ? String(value) : "",
    async (next) => {
      setError(null);
      const trimmed = next.trim();
      // Clearing numbers isn't supported yet (needs nullable server fields).
      if (trimmed === "") return;
      const n = Number(trimmed);
      if (!Number.isInteger(n)) {
        setError("Enter a whole number");
        throw new Error("invalid");
      }
      if (min != null && n < min) {
        setError(`Must be ${min} or more`);
        throw new Error("invalid");
      }
      if (max != null && n > max) {
        setError(`Must be ${max} or less`);
        throw new Error("invalid");
      }
      await save({ [field]: n } as UpdateStartupRequest);
    },
  );

  const hasValue = value != null && value > 0;
  const start = () => {
    setError(null);
    edit.start();
  };
  const cancel = () => {
    setError(null);
    edit.cancel();
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") cancel();
    if (e.key === "Enter") {
      e.preventDefault();
      edit.commit();
    }
  };

  return (
    <EditShell
      display={
        hasValue && display ? (
          display(value as number)
        ) : (
          <span className={className}>{value}</span>
        )
      }
      placeholder={placeholder}
      placeholderClassName={className}
      hasValue={hasValue}
      editing={edit.editing}
      saving={edit.saving}
      error={error}
      onStart={start}
      onCommit={() => edit.commit()}
      onCancel={cancel}
      input={
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={edit.draft}
          disabled={edit.saving}
          placeholder={placeholder}
          onChange={(e) => edit.setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className={`${inputBase} w-24 ${error ? "border-danger" : ""} ${className ?? ""}`}
        />
      }
    />
  );
}

interface EditableLocationProps {
  field: StringField;
  value: string;
  placeholder?: string;
  /** Tailwind classes applied to the placeholder and the input. */
  className?: string;
  display?: (value: string) => ReactNode;
}

/** Location editor backed by the Mapbox city autocomplete (LocationInput). */
export function EditableLocation({
  field,
  value,
  placeholder = "Location",
  className,
  display,
}: EditableLocationProps) {
  const { save } = useProfileEdit();
  const edit = useInlineEdit(value, (next) =>
    save({ [field]: next } as UpdateStartupRequest),
  );

  const commit = () => {
    const next = edit.draft.trim();
    if (!next) {
      edit.cancel();
      return;
    }
    edit.commit(next);
  };

  return (
    <EditShell
      display={display ? display(value) : <span>{value}</span>}
      placeholder={placeholder}
      placeholderClassName={className}
      hasValue={value.length > 0}
      editing={edit.editing}
      saving={edit.saving}
      onStart={edit.start}
      onCommit={commit}
      onCancel={edit.cancel}
      input={
        <div className="w-56">
          <LocationInput
            id={`edit-${field}`}
            value={edit.draft}
            onChange={edit.setDraft}
            className={`${inputBase} w-full ${className ?? ""}`}
          />
        </div>
      }
    />
  );
}

interface EditableSelectProps {
  field: StringField;
  value: string;
  options: readonly string[];
  placeholder?: string;
  display?: (value: string) => ReactNode;
}

/**
 * Enum editor backed by Radix Select: the trigger doubles as the click-to-edit
 * display (pill + pencil), and picking an option saves immediately — no
 * separate confirm step. Accessibility, keyboard nav and positioning come from
 * Radix, so this only supplies styling and the save wiring.
 */
export function EditableSelect({
  field,
  value,
  options,
  placeholder = "Select…",
  display,
}: EditableSelectProps) {
  const { isOwner, isSaving, save } = useProfileEdit();
  const hasValue = value.length > 0;

  // Viewers: value only, nothing when empty.
  if (!isOwner) {
    if (!hasValue) return null;
    return <>{display ? display(value) : value}</>;
  }

  return (
    <Select.Root
      value={hasValue ? value : undefined}
      disabled={isSaving}
      onValueChange={(next) => {
        if (next !== value) save({ [field]: next } as UpdateStartupRequest);
      }}
    >
      <Select.Trigger
        aria-label={field}
        className="group inline-flex max-w-full items-start gap-1 rounded text-left outline-none disabled:opacity-50"
      >
        <span>
          {hasValue ? (
            display ? (
              display(value)
            ) : (
              value
            )
          ) : (
            <span className="text-sm text-text-subtle">{placeholder}</span>
          )}
        </span>
        <Pencil
          size={15}
          className="mt-1.5 shrink-0 text-text-subtle opacity-0 transition group-hover:text-brand group-hover:opacity-100"
        />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-[var(--radix-select-content-available-height)] overflow-hidden rounded-lg border border-border bg-bg shadow-lg"
        >
          <Select.Viewport className="max-h-72 overflow-y-auto p-1">
            {options.map((opt) => (
              <Select.Item
                key={opt}
                value={opt}
                className="flex cursor-pointer items-center gap-2 rounded-md py-1.5 pl-2 pr-3 text-sm text-text outline-none data-[highlighted]:bg-bg-subtle data-[state=checked]:text-brand"
              >
                <span className="flex w-4 shrink-0 items-center justify-center">
                  <Select.ItemIndicator>
                    <Check size={14} />
                  </Select.ItemIndicator>
                </span>
                <Select.ItemText>{opt}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
