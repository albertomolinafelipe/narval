"use client";

import { useUser } from "@/lib/user";
import { useEffect } from "react";
import { identifySession } from "@/lib/analytics";

/**
 * Component that identifies the current user session with Umami analytics
 * Uses email as the distinct session identifier
 */
export default function SessionIdentifier() {
  const { user, authenticated } = useUser();

  useEffect(() => {
    if (authenticated && user?.email) {
      identifySession(user.email);
    }
  }, [user, authenticated]);

  return null;
}
