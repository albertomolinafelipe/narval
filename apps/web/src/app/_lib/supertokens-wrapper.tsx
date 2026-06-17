"use client";

import SuperTokensReact from "supertokens-auth-react";
import { superTokensConfig } from "@/config/supertokens";
import { useSessionSync } from "@/lib/use-session-sync";
import { UserProvider } from "@/lib/user";

// Initialize SuperTokens on the client
if (typeof window !== "undefined") {
  SuperTokensReact.init(superTokensConfig);
}

function SessionSyncProvider({ children }: { children: React.ReactNode }) {
  useSessionSync();
  return <>{children}</>;
}

export default function SuperTokensWrapper({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <SessionSyncProvider>
        {children}
      </SessionSyncProvider>
    </UserProvider>
  );
}
