"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface PillInputProps {
  id?: string;
  value: string; // comma-separated
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * A tag/pill input that stores its value as a comma-separated string.
 * Press Enter or type a comma to add a tag. Click × to remove.
 */
export default function PillInput({
  id,
  value,
  onChange,
  placeholder,
}: PillInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = value
    ? value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    const next = [...tags, tag];
    onChange(next.join(","));
    setInput("");
  }

  function removeTag(index: number) {
    const next = tags.filter((_, i) => i !== index);
    onChange(next.join(","));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val.endsWith(",")) {
      addTag(val.slice(0, -1));
    } else {
      setInput(val);
    }
  }

  return (
    <div
      className="input flex min-h-[2.5rem] flex-wrap items-center gap-1.5 cursor-text py-1.5"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-raised px-2 py-0.5 text-xs text-text"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(i);
            }}
            className="text-text-subtle hover:text-text"
            aria-label={`Remove ${tag}`}
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="min-w-[120px] flex-1 border-none bg-transparent p-0 text-sm text-text outline-none placeholder:text-text-subtle"
      />
    </div>
  );
}
