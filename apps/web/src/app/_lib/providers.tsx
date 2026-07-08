"use client";

import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";
import { AuthModalProvider } from "../_components/auth/auth-modal-context";
import AuthModal from "../_components/auth/auth-modal";
import { QueryProvider } from "@/lib/query-provider";

// Dynamically import SuperTokens components to avoid SSR issues
const SuperTokensWrapper = dynamic(() => import("./supertokens-wrapper"), {
  ssr: false,
});

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryProvider>
        <SuperTokensWrapper>
          <AuthModalProvider>
            {children}
            <AuthModal />
          </AuthModalProvider>
        </SuperTokensWrapper>
      </QueryProvider>
    </ThemeProvider>
  );
}
