/**
 * User abstraction layer
 *
 * Provides a consistent API for accessing user authentication state and profile data,
 * regardless of the underlying authentication provider.
 *
 * @example
 * ```tsx
 * import { useUser } from "@/lib/user";
 *
 * function MyComponent() {
 *   const { user, authenticated, loading } = useUser();
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (!authenticated) return <div>Please log in</div>;
 *
 *   return <div>Welcome {user.nickname}!</div>;
 * }
 * ```
 */

export { UserProvider } from "./context";
export { useUser, useRequireUser, useIsAccountType } from "./use-user";
export { useMyStartup } from "./use-my-startup";
export type { User, AccountType, UserContextValue } from "./types";
