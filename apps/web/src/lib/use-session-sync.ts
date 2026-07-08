"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook that invalidates all queries when the session changes (login/logout).
 * This ensures authenticated-only data is refetched with the correct auth state.
 */
export function useSessionSync() {
  const queryClient = useQueryClient();
  const prevExistsRef = useRef<boolean | undefined>(undefined);

  // Handle session state changes (login/logout)
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cleanup = false;

    import("supertokens-auth-react/recipe/session").then((Session) => {
      if (cleanup) return;

      Session.doesSessionExist().then((currentExists) => {
        if (cleanup) return;

        const prevExists = prevExistsRef.current;

        // When session state changes (login or logout), invalidate queries
        if (prevExists !== undefined && prevExists !== currentExists) {
          queryClient.invalidateQueries();
        }

        prevExistsRef.current = currentExists;
      });
    });

    return () => {
      cleanup = true;
    };
  }, [queryClient]);
}
