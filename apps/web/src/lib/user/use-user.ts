"use client";

import { useUserContext } from "./context";
import type { User, AccountType } from "./types";

/**
 * useUser - Main hook for accessing user authentication and profile data
 *
 * This hook provides a consistent API for components regardless of the
 * underlying authentication provider (SuperTokens, NextAuth, etc.)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, authenticated, loading } = useUser();
 *
 *   if (loading) return <Spinner />;
 *   if (!authenticated) return <LoginPrompt />;
 *
 *   return <div>Hello {user.nickname}!</div>;
 * }
 * ```
 *
 * @returns {Object} User state
 * @returns {User | null} user - Current authenticated user, or null if not authenticated
 * @returns {boolean} loading - Whether user data is currently being loaded
 * @returns {boolean} authenticated - Whether a user is authenticated
 * @returns {Function} refetch - Function to refetch user profile data
 */
export function useUser() {
  return useUserContext();
}

/**
 * useRequireUser - Hook that ensures user is authenticated
 *
 * This hook throws an error if used in a component that renders while
 * not authenticated. Use this in components that should only render
 * when authenticated.
 *
 * @example
 * ```tsx
 * function ProfilePage() {
 *   const user = useRequireUser();
 *   // user is guaranteed to be non-null here
 *   return <div>Email: {user.email}</div>;
 * }
 * ```
 *
 * @returns {User} Authenticated user (guaranteed non-null)
 * @throws {Error} If user is not authenticated
 */
export function useRequireUser(): User {
  const { user, authenticated, loading } = useUserContext();

  if (loading) {
    // Still loading - return a placeholder that won't be used
    // Component should handle loading state before calling this
    throw new Error("useRequireUser called while loading");
  }

  if (!authenticated || !user) {
    throw new Error("useRequireUser used in unauthenticated context");
  }

  return user;
}

/**
 * useIsAccountType - Check if user has a specific account type
 *
 * @example
 * ```tsx
 * function StartupDashboard() {
 *   const isStartup = useIsAccountType("startup");
 *   if (!isStartup) return <AccessDenied />;
 *   return <Dashboard />;
 * }
 * ```
 */
export function useIsAccountType(accountType: AccountType): boolean {
  const { user } = useUserContext();
  return user?.account_type === accountType;
}
