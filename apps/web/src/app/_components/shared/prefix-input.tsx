"use client";

import type { KeyboardEvent } from "react";

interface PrefixInputProps {
  /** Fixed, non-editable label shown to the left (e.g. "linkedin.com/in/"). */
  prefix: string;
  /** The editable suffix (handle), not including the prefix. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** Extra classes for the wrapper (width, background, …). */
  className?: string;
  /** Extra classes for the input (font size, …). */
  inputClassName?: string;
}

/**
 * Text input fronted by a fixed prefix chip — for fields stored as
 * `prefix + handle` (social links, founder LinkedIn, …). The caller owns
 * prefix/suffix composition; this only renders the editable suffix.
 */
export default function PrefixInput({
  prefix,
  value,
  onChange,
  placeholder,
  disabled,
  id,
  autoFocus,
  onKeyDown,
  className,
  inputClassName,
}: PrefixInputProps) {
  return (
    <div
      className={`flex overflow-hidden rounded-lg border border-border bg-bg focus-within:border-brand ${className ?? ""}`}
    >
      <span className="flex shrink-0 select-none items-center border-r border-border bg-bg-subtle px-2 text-xs text-text-subtle">
        {prefix}
      </span>
      <input
        id={id}
        autoFocus={autoFocus}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className={`min-w-0 flex-1 bg-transparent px-2 py-1 text-sm text-text outline-none placeholder:text-text-subtle disabled:opacity-50 ${inputClassName ?? ""}`}
      />
    </div>
  );
}
