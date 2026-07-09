// Unwrap a generated SDK result, throwing a plain Error on failure so callers
// (and React Query) see a consistent error. The generated client never throws
// by default; it returns { data, error, response }.
export async function unwrap<T>(
  result: Promise<{ data?: T; error?: unknown; response?: Response }>,
): Promise<T> {
  const { data, error, response } = await result;
  if (!response?.ok || error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : `Request failed: ${response?.status ?? "network error"}`;
    throw new Error(message);
  }
  return data as T;
}
