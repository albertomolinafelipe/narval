"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserContextValue, User } from "./types";

const UserContext = createContext<UserContextValue | undefined>(undefined);

/**
 * UserProvider - Manages user authentication state and profile data
 * 
 * This provider:
 * 1. Wraps SuperTokens session management (checked client-side only)
 * 2. Fetches user profile data from /auth/me when authenticated
 * 3. Provides a consistent API for components via useUser() hook
 * 
 * Usage:
 *   Wrap your app with <UserProvider> in providers.tsx
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [sessionExists, setSessionExists] = useState<boolean>(false);
  const [sessionLoading, setSessionLoading] = useState<boolean>(true);
  const queryClient = useQueryClient();

  // Handle SuperTokens session check client-side only
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    import("supertokens-auth-react/recipe/session").then((Session) => {
      Session.doesSessionExist().then((exists) => {
        setSessionExists(exists);
        setSessionLoading(false);
      });
    });
  }, []);
  
  // Fetch user profile when session exists
  const { data: user = null, isLoading: isUserLoading, refetch } = useQuery<User | null>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/proxy/auth/me", {
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          return null;
        }
        throw new Error("Failed to fetch user profile");
      }
      
      return res.json();
    },
    enabled: !sessionLoading && sessionExists,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: 1, // Only retry once on failure
  });

  // Clear user profile cache when session ends
  useEffect(() => {
    if (!sessionLoading && !sessionExists && user !== null) {
      queryClient.setQueryData(["user-profile"], null);
    }
  }, [sessionExists, sessionLoading, user, queryClient]);

  const value: UserContextValue = {
    user,
    loading: sessionLoading || (sessionExists && isUserLoading),
    authenticated: sessionExists,
    refetch,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/**
 * useUserContext - Access the raw user context
 * Internal hook - use useUser() instead in most cases
 */
export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}
