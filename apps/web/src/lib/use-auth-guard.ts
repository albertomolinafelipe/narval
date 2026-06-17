"use client";

import { useUser } from "@/lib/user";
import { useAuthModal } from "@/app/_components/auth/auth-modal-context";

/**
 * Returns a guard function. Call it before any action that requires the user
 * to be signed in. If the user is not authenticated it opens the auth modal
 * and returns false; otherwise returns true.
 *
 * Usage:
 *   const requireAuth = useAuthGuard();
 *   function handleSave() {
 *     if (!requireAuth()) return;
 *     // ... proceed with authenticated action
 *   }
 */
export function useAuthGuard() {
  const { authenticated } = useUser();
  const { openModal } = useAuthModal();

  return function requireAuth(): boolean {
    if (authenticated) return true;
    openModal();
    return false;
  };
}
