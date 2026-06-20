"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/user";
import {
  fetchStartups,
  fetchStartup,
  toggleFavorite,
  boostStartup,
  type FetchStartupsOptions,
} from "./client";
import { components } from "./generated";
import { trackBoost } from "@/lib/analytics";

type Startup = components["schemas"]["Startup"];

// Query Keys
export const startupsKeys = {
  all: ["startups"] as const,
  lists: () => [...startupsKeys.all, "list"] as const,
  list: (filters: FetchStartupsOptions) =>
    [...startupsKeys.lists(), filters] as const,
  details: () => [...startupsKeys.all, "detail"] as const,
  detail: (id: string) => [...startupsKeys.details(), id] as const,
};

/**
 * Query hook for fetching startups list with optional filters.
 * Uses SuperTokens session cookies for authentication automatically.
 */
export function useStartupsQuery(
  options: {
    favorited?: boolean;
    sort?: "recent" | "trending";
    // Refetch every time the component mounts (e.g. on navigating back to the
    // page) so the list reflects changes made elsewhere. Overrides the global
    // refetchOnMount: false default.
    refetchOnMount?: boolean | "always";
  } = {},
) {
  const { authenticated, loading } = useUser();

  return useQuery({
    queryKey: startupsKeys.list({ favorited: options.favorited, sort: options.sort }),
    queryFn: () =>
      fetchStartups({
        favorited: options.favorited,
        sort: options.sort,
      }),
    enabled: !loading && (!options.favorited || authenticated),
    refetchOnMount: options.refetchOnMount,
  });
}

/**
 * Query hook for fetching a single startup by ID.
 * Uses SuperTokens session cookies for authentication automatically.
 */
export function useStartupQuery(id: string, placeholderData?: Startup) {
  const { loading } = useUser();

  return useQuery({
    queryKey: startupsKeys.detail(id),
    queryFn: () =>
      fetchStartup(id, {
        // No need to pass accessToken - SuperTokens uses cookies
      }),
    placeholderData, // Use placeholderData instead of initialData
    // Refetch when session becomes available
    enabled: !loading,
  });
}

/**
 * Mutation hook for toggling favorite status on a startup.
 * Includes optimistic updates and automatic cache invalidation.
 */
export function useFavoriteMutation() {
  const { authenticated } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isFavorited }: { id: string; isFavorited: boolean }) => {
      if (!authenticated) {
        throw new Error("Authentication required");
      }
      // No need to pass accessToken - SuperTokens uses cookies
      return toggleFavorite(id, isFavorited);
    },
    onMutate: async ({ id, isFavorited }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: startupsKeys.all });

      // Snapshot the previous values for rollback
      const previousStartup = queryClient.getQueryData(startupsKeys.detail(id));
      const previousStartupsList = queryClient.getQueryData(
        startupsKeys.list({ favorited: false }),
      );
      const previousFavoritesList = queryClient.getQueryData(
        startupsKeys.list({ favorited: true }),
      );

      // Optimistically update the single startup cache
      queryClient.setQueryData<Startup>(startupsKeys.detail(id), (old) => {
        if (!old) return old;
        return { ...old, is_favorited: !isFavorited };
      });

      // Optimistically update the all startups list
      queryClient.setQueryData<Startup[]>(
        startupsKeys.list({ favorited: false }),
        (old) => {
          if (!old) return old;
          return old.map((startup) =>
            startup.id === id
              ? { ...startup, is_favorited: !isFavorited }
              : startup,
          );
        },
      );

      // Optimistically update the favorites list
      if (isFavorited) {
        // Removing from favorites - filter it out
        queryClient.setQueryData<Startup[]>(
          startupsKeys.list({ favorited: true }),
          (old) => {
            if (!old) return old;
            return old.filter((startup) => startup.id !== id);
          },
        );
      } else {
        // Adding to favorites - need to refetch to get it (we don't have the full object here)
        // We'll invalidate instead of optimistic add
      }

      // Return context for rollback
      return { previousStartup, previousStartupsList, previousFavoritesList };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousStartup) {
        queryClient.setQueryData(
          startupsKeys.detail(_variables.id),
          context.previousStartup,
        );
      }
      if (context?.previousStartupsList) {
        queryClient.setQueryData(
          startupsKeys.list({ favorited: false }),
          context.previousStartupsList,
        );
      }
      if (context?.previousFavoritesList) {
        queryClient.setQueryData(
          startupsKeys.list({ favorited: true }),
          context.previousFavoritesList,
        );
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: startupsKeys.all });
    },
  });
}

/**
 * Mutation hook for boosting a startup.
 * Includes optimistic updates and automatic cache invalidation.
 */
export function useBoostMutation() {
  const { authenticated } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => {
      if (!authenticated) {
        throw new Error("Authentication required");
      }
      // No need to pass accessToken - SuperTokens uses cookies
      return boostStartup(id);
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: startupsKeys.all });

      // Snapshot the previous values for rollback
      const previousStartup = queryClient.getQueryData(startupsKeys.detail(id));
      const previousStartupsList = queryClient.getQueryData(
        startupsKeys.list({ favorited: false }),
      );

      // Optimistically update the single startup cache
      queryClient.setQueryData<Startup>(startupsKeys.detail(id), (old) => {
        if (!old) return old;
        // Don't update if already boosted - prevents count increment on repeated clicks
        if (old.has_boosted) return old;
        return {
          ...old,
          has_boosted: true,
          boost_count: (old.boost_count ?? 0) + 1,
        };
      });

      // Optimistically update the all startups list
      queryClient.setQueryData<Startup[]>(
        startupsKeys.list({ favorited: false }),
        (old) => {
          if (!old) return old;
          return old.map((startup) =>
            startup.id === id
              ? // Don't update if already boosted
                startup.has_boosted
                ? startup
                : {
                    ...startup,
                    has_boosted: true,
                    boost_count: (startup.boost_count ?? 0) + 1,
                  }
              : startup,
          );
        },
      );

      // Return context for rollback
      return { previousStartup, previousStartupsList };
    },
    onError: (_err, id, context) => {
      // Rollback on error
      if (context?.previousStartup) {
        queryClient.setQueryData(
          startupsKeys.detail(id),
          context.previousStartup,
        );
      }
      if (context?.previousStartupsList) {
        queryClient.setQueryData(
          startupsKeys.list({ favorited: false }),
          context.previousStartupsList,
        );
      }
    },
    onSuccess: (_data, id) => {
      // Track successful boost in Umami analytics
      trackBoost(id);
    },
    onSettled: () => {
      // Refetch to ensure consistency (gets real boost count from server)
      queryClient.invalidateQueries({ queryKey: startupsKeys.all });
    },
  });
}
