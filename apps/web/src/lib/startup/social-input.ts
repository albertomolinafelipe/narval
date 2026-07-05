/**
 * Normalize what a user types or pastes into a `PrefixInput` down to the bare
 * handle that sits after a fixed prefix (e.g. `https://linkedin.com/company/`).
 *
 * Accepts a plain handle (`acme`), the full URL
 * (`https://www.linkedin.com/company/acme/`), or anything between. Returns an
 * `error` when a pasted URL points somewhere the prefix can't represent — a
 * different site, or the wrong path on the right site (e.g. a personal
 * `linkedin.com/in/…` link dropped into a `linkedin.com/company/…` field).
 */
export interface NormalizedHandle {
  /** The handle to display/store (empty when input is blank). */
  handle: string;
  /** Non-null when a pasted URL doesn't match the prefix. */
  error: string | null;
}

export function normalizeToHandle(input: string, prefix: string): NormalizedHandle {
  const raw = input.trim();
  if (!raw) return { handle: "", error: null };

  const bare = prefix.replace(/^https?:\/\//i, ""); // linkedin.com/company/
  const sep = bare.indexOf("/");
  const domain = bare.slice(0, sep); // linkedin.com
  const path = bare.slice(sep); // /company/

  const stripped = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const mismatch = `Enter a ${domain}${path}… link`;

  // Pasted a URL on the right domain — keep the path after the domain.
  if (stripped.toLowerCase().startsWith(domain.toLowerCase())) {
    const rest = stripped.slice(domain.length); // /company/acme  or  /in/jane
    if (!rest.toLowerCase().startsWith(path.toLowerCase())) {
      return { handle: raw, error: mismatch };
    }
    return { handle: trim(rest.slice(path.length)), error: null };
  }

  // Pasted a URL for some other site — reject.
  if (/^https?:\/\//i.test(raw) || /^[\w-]+(\.[\w-]+)+\//.test(stripped)) {
    return { handle: raw, error: mismatch };
  }

  // A bare handle — tolerate a leading copy of the path (e.g. "company/acme").
  const pathNoSlash = path.replace(/^\/+/, "");
  const handle = raw.replace(/^\/+/, "");
  return {
    handle: trim(
      handle.toLowerCase().startsWith(pathNoSlash.toLowerCase())
        ? handle.slice(pathNoSlash.length)
        : handle,
    ),
    error: null,
  };
}

const trim = (s: string) => s.replace(/^\/+|\/+$/g, "");
