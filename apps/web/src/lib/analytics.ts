/**
 * Umami Analytics Tracking
 *
 * This file provides utilities for tracking user interactions with Umami Analytics.
 *
 * What's tracked:
 * - Page views (automatic by Umami)
 * - User sessions (identified by email)
 * - Authentication events (login, logout, registration)
 * - Entity detail page views (startup/investor profiles)
 * - Boost actions (when users boost startups)
 * - Favorite actions (when users favorite/unfavorite startups)
 *
 * See ANALYTICS.md for more details.
 */

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, unknown>) => void;
      identify: (uniqueId: string) => void;
    };
  }
}

/**
 * Track a custom event in Umami
 * @param eventName - Name of the event (e.g., "auth", "view-detail")
 * @param eventData - Optional data to associate with the event
 */
export function trackEvent(
  eventName: string,
  eventData?: Record<string, unknown>,
) {
  if (typeof window !== "undefined" && window.umami) {
    window.umami.track(eventName, eventData);
  }
}

/**
 * Identify a user session with their email
 * This allows tracking individual user journeys across sessions
 * @param email - User's email address as unique identifier
 */
export function identifySession(email: string) {
  if (typeof window !== "undefined" && window.umami) {
    window.umami.identify(email);
  }
}

/**
 * Track authentication events (login, registration, logout, OTP code sent/verified)
 * @param action - The auth action performed
 * @param additionalData - Additional context (e.g., success, accountType, error)
 */
export function trackAuth(
  action: "login" | "register" | "logout" | "login_code_sent" | "login_code_verified" | "register_code_sent" | "register_code_verified",
  additionalData?: Record<string, unknown>,
) {
  trackEvent("auth", { action, ...additionalData });
}

/**
 * Track viewing of entity detail pages (startup or investor profiles)
 * @param entityType - Type of entity being viewed
 * @param entityId - ID of the entity
 * @param additionalData - Additional context (e.g., name, industry, stage)
 */
export function trackViewDetail(
  entityType: "startup" | "investor",
  entityId: string,
  additionalData?: Record<string, unknown>,
) {
  trackEvent("view-detail", { entityType, entityId, ...additionalData });
}

/**
 * Track boost actions on startups
 * @param startupId - ID of the startup being boosted
 */
export function trackBoost(startupId: string) {
  trackEvent("boost", { startupId });
}

/**
 * Track favorite/unfavorite actions on startups
 * @param startupId - ID of the startup being favorited/unfavorited
 * @param isFavorited - Whether the startup is being favorited (true) or unfavorited (false)
 */
export function trackFavorite(startupId: string, isFavorited: boolean) {
  trackEvent("favorite", {
    startupId,
    action: isFavorited ? "favorite" : "unfavorite",
  });
}
