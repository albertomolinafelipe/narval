"use client";

import { useState, useEffect, useRef } from "react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

interface Suggestion {
  label: string; // "City, Country"
}

interface MapboxFeature {
  place_name: string;
}

interface MapboxResponse {
  features: MapboxFeature[];
}

async function fetchSuggestions(query: string): Promise<Suggestion[]> {
  if (!MAPBOX_TOKEN || query.trim().length < 2) return [];

  const encoded = encodeURIComponent(query);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?types=place&limit=6&language=en&access_token=${MAPBOX_TOKEN}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data: MapboxResponse = await res.json();
    return data.features.map((f) => ({ label: f.place_name }));
  } catch {
    return [];
  }
}

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function LocationInput({
  id,
  value,
  onChange,
  className,
}: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Only fetch after the user has actually typed — prevents the dropdown from
  // opening immediately when the form loads with a pre-filled value.
  const userHasTyped = useRef(false);

  // Keep internal query in sync when parent resets the value (e.g. form reset)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(value);
    userHasTyped.current = false;
  }, [value]);

  // Debounced autocomplete fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!MAPBOX_TOKEN || !userHasTyped.current) return;

    debounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(query);
      setSuggestions(results);
      setOpen(results.length > 0);
      setActiveIndex(-1);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(label: string) {
    setQuery(label);
    onChange(label);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      select(suggestions[activeIndex].label);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Degrade gracefully when no token is configured
  if (!MAPBOX_TOKEN) {
    return (
      <input
        id={id}
        type="text"
        placeholder="San Francisco, USA"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={100}
        className={className}
      />
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        placeholder="San Francisco, USA"
        value={query}
        autoComplete="off"
        maxLength={100}
        className={className}
        onChange={(e) => {
          userHasTyped.current = true;
          setQuery(e.target.value);
          // Clear confirmed value while the user is typing
          onChange("");
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-bg py-1 shadow-lg">
          {suggestions.map((s, i) => (
            <li
              key={s.label}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before click
                select(s.label);
              }}
              className={`cursor-pointer px-3 py-2 text-sm text-text ${
                i === activeIndex ? "bg-bg-subtle" : "hover:bg-bg-subtle"
              }`}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
