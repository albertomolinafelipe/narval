"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/user";
import { trackBoost } from "@/lib/analytics";
import {
  boostStartup,
  deleteStartupBanner,
  deleteStartupLogo,
  favoriteStartup,
  unfavoriteStartup,
  updateStartup,
  uploadStartupBanner,
  uploadStartupLogo,
} from "./gen";
import type {
  ListStartupsData,
  Startup,
  UpdateStartupRequest,
} from "./gen";
import {
  getStartupOptions,
  getStartupQueryKey,
  listStartupsOptions,
  listStartupsQueryKey,
} from "./gen/@tanstack/react-query.gen";

export type StartupImageKind = "logo" | "banner";

type SortOrder = "recent" | "trending";
type ListFilters = { favorited?: boolean };

// Newest first — the server's default order and the `recent` sort.
function createdDesc(a: Startup, b: Startup): number {
  return (
    new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  );
}

// Sorting is done client-side over the already-fetched list; the server's
// `?sort=` param is left in the API but no longer sent. `trending` ranks by
// active boosts, falling back to recency for ties.
function sortStartups(list: Startup[], sort: SortOrder): Startup[] {
  const copy = [...list];
  if (sort === "trending") {
    copy.sort(
      (a, b) => (b.boost_count ?? 0) - (a.boost_count ?? 0) || createdDesc(a, b),
    );
  } else {
    copy.sort(createdDesc);
  }
  return copy;
}

// Unwrap a generated SDK result, throwing a plain Error on failure so callers
// (and React Query) see a consistent error. Defaults are omitted from the
// query so the request — and its cache key — match the server's behaviour.
async function unwrap<T>(
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

function listQuery({ favorited }: ListFilters): ListStartupsData["query"] {
  const query: NonNullable<ListStartupsData["query"]> = {};
  if (favorited) query.favorited = true;
  return query;
}

const listKey = (filters: ListFilters = {}) =>
  listStartupsQueryKey({ query: listQuery(filters) });
const detailKey = (id: string) => getStartupQueryKey({ path: { id } });

/** Invalidate every startup list variant (all filters/sorts). */
function invalidateLists(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: listStartupsQueryKey() });
}

/**
 * Query hook for the startups list with optional filters. Uses SuperTokens
 * session cookies (forwarded by the /api/proxy route) for authentication.
 */
export function useStartupsQuery(
  options: {
    favorited?: boolean;
    sort?: SortOrder;
    // Refetch on mount (e.g. navigating back) so the list reflects changes
    // made elsewhere. Overrides the global refetchOnMount: false default.
    refetchOnMount?: boolean | "always";
  } = {},
) {
  const { authenticated, loading } = useUser();

  // Sort in memory so every sort order shares one fetch/cache entry. React
  // Compiler memoises the inline select on `sort`.
  const sort = options.sort ?? "recent";

  return useQuery({
    ...listStartupsOptions({ query: listQuery(options) }),
    enabled: !loading && (!options.favorited || authenticated),
    refetchOnMount: options.refetchOnMount,
    select: (data) => sortStartups(data, sort),
  });
}

/** Query hook for a single startup by UUID or verified domain. */
export function useStartupQuery(id: string, placeholderData?: Startup) {
  const { loading } = useUser();

  return useQuery({
    ...getStartupOptions({ path: { id } }),
    placeholderData,
    enabled: !loading,
  });
}

/**
 * Mutation hook for partially updating a startup (in-place editing). Sends only
 * the changed fields; on success updates the detail cache with the returned
 * startup and refreshes the lists. Owner enforcement is server-side.
 */
export function useUpdateStartupMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: UpdateStartupRequest) =>
      unwrap(updateStartup({ path: { id }, body: patch })),
    onSuccess: (updated) => {
      queryClient.setQueryData(detailKey(id), updated);
      invalidateLists(queryClient);
    },
  });
}

/**
 * Mutation hook for a startup's logo/banner: upload a cropped blob or remove
 * it. On success updates the detail cache and refreshes the lists so avatars
 * elsewhere reflect the change. Owner enforcement is server-side.
 */
export function useStartupImageMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      kind,
      blob,
    }: {
      kind: StartupImageKind;
      blob: Blob | null;
    }) => {
      if (!blob) {
        return unwrap(
          kind === "logo"
            ? deleteStartupLogo({ path: { id } })
            : deleteStartupBanner({ path: { id } }),
        );
      }
      // Wrap in a File so the multipart part carries a filename — Go's
      // FormFile() ignores nameless parts.
      const file = new File([blob], `${kind}.jpg`, {
        type: blob.type || "image/jpeg",
      });
      return unwrap(
        kind === "logo"
          ? uploadStartupLogo({ path: { id }, body: { logo: file } })
          : uploadStartupBanner({ path: { id }, body: { banner: file } }),
      );
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(detailKey(id), updated);
      invalidateLists(queryClient);
    },
  });
}

/**
 * Mutation hook for toggling favorite status, with optimistic updates across
 * the detail and list caches and rollback on error.
 */
export function useFavoriteMutation() {
  const { authenticated } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isFavorited }: { id: string; isFavorited: boolean }) => {
      if (!authenticated) throw new Error("Authentication required");
      return unwrap(
        isFavorited
          ? unfavoriteStartup({ path: { id } })
          : favoriteStartup({ path: { id } }),
      );
    },
    onMutate: async ({ id, isFavorited }) => {
      await queryClient.cancelQueries({ queryKey: listStartupsQueryKey() });

      const previousStartup = queryClient.getQueryData(detailKey(id));
      const previousStartupsList = queryClient.getQueryData(listKey());
      const previousFavoritesList = queryClient.getQueryData(
        listKey({ favorited: true }),
      );

      queryClient.setQueryData<Startup>(detailKey(id), (old) =>
        old ? { ...old, is_favorited: !isFavorited } : old,
      );
      queryClient.setQueryData<Startup[]>(listKey(), (old) =>
        old?.map((s) =>
          s.id === id ? { ...s, is_favorited: !isFavorited } : s,
        ),
      );
      // Removing from favorites: drop it from the favorites list. Adding is
      // left to the onSettled refetch (we lack the full object here).
      if (isFavorited) {
        queryClient.setQueryData<Startup[]>(listKey({ favorited: true }), (old) =>
          old?.filter((s) => s.id !== id),
        );
      }

      return { previousStartup, previousStartupsList, previousFavoritesList };
    },
    onError: (_err, { id }, context) => {
      if (context?.previousStartup) {
        queryClient.setQueryData(detailKey(id), context.previousStartup);
      }
      if (context?.previousStartupsList) {
        queryClient.setQueryData(listKey(), context.previousStartupsList);
      }
      if (context?.previousFavoritesList) {
        queryClient.setQueryData(
          listKey({ favorited: true }),
          context.previousFavoritesList,
        );
      }
    },
    onSettled: () => invalidateLists(queryClient),
  });
}

/**
 * Mutation hook for boosting a startup, with optimistic updates. A repeat boost
 * returns 409 from the server, which we treat as success (the count is already
 * reflected) rather than an error.
 */
export function useBoostMutation() {
  const { authenticated } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!authenticated) throw new Error("Authentication required");
      const { error, response } = await boostStartup({ path: { id } });
      if (response?.status === 409) return; // already boosted — idempotent
      if (!response?.ok || error) throw new Error("Failed to boost startup");
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: listStartupsQueryKey() });

      const previousStartup = queryClient.getQueryData(detailKey(id));
      const previousStartupsList = queryClient.getQueryData(listKey());

      const boost = (s: Startup): Startup =>
        s.has_boosted
          ? s
          : { ...s, has_boosted: true, boost_count: (s.boost_count ?? 0) + 1 };

      queryClient.setQueryData<Startup>(detailKey(id), (old) =>
        old ? boost(old) : old,
      );
      queryClient.setQueryData<Startup[]>(listKey(), (old) =>
        old?.map((s) => (s.id === id ? boost(s) : s)),
      );

      return { previousStartup, previousStartupsList };
    },
    onError: (_err, id, context) => {
      if (context?.previousStartup) {
        queryClient.setQueryData(detailKey(id), context.previousStartup);
      }
      if (context?.previousStartupsList) {
        queryClient.setQueryData(listKey(), context.previousStartupsList);
      }
    },
    onSuccess: (_data, id) => trackBoost(id),
    onSettled: () => invalidateLists(queryClient),
  });
}
