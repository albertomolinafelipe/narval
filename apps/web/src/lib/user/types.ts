/**
 * User abstraction layer types
 * Provides a consistent interface for user data regardless of auth provider
 */

import type { AccountType, UserProfile } from "@/lib/api/gen";

export type { AccountType };

/** The /auth/me profile — the generated spec type, re-exported under the
 * context's historical name. */
export type User = UserProfile;

export interface UserContextValue {
  /** Current authenticated user, or null if not authenticated */
  user: User | null;
  /** Whether user data is currently being loaded */
  loading: boolean;
  /** Whether a user is authenticated (session exists) */
  authenticated: boolean;
  /** Refetch user profile data */
  refetch: () => void;
}
