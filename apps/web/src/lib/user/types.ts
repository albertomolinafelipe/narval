/**
 * User abstraction layer types
 * Provides a consistent interface for user data regardless of auth provider
 */

export type AccountType = "user" | "startup";

export interface User {
  id: string;
  email: string;
  nickname: string;
  account_type: AccountType;
  profile_id?: string | null;
  logo_url?: string | null;
  /** True when the email is on the admin whitelist (may seed startup shells). */
  is_admin?: boolean;
  created_at: string;
}

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
