"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { components } from "@/lib/api/generated";
import { useUpdateStartupMutation } from "@/lib/api/use-startups-query";

type UpdateStartupRequest = components["schemas"]["UpdateStartupRequest"];

interface ProfileEditValue {
  /** UX gate only — real authorization is enforced server-side (403 if not owner). */
  isOwner: boolean;
  isSaving: boolean;
  /** Persist a partial update. Callers pass only the field(s) they changed. */
  save: (patch: UpdateStartupRequest) => Promise<void>;
}

const ProfileEditContext = createContext<ProfileEditValue | null>(null);

export function useProfileEdit(): ProfileEditValue {
  const ctx = useContext(ProfileEditContext);
  if (!ctx) {
    throw new Error("useProfileEdit must be used within a ProfileEditProvider");
  }
  return ctx;
}

export function ProfileEditProvider({
  startupId,
  isOwner,
  children,
}: {
  startupId: string;
  isOwner: boolean;
  children: ReactNode;
}) {
  const mutation = useUpdateStartupMutation(startupId);

  const value = useMemo<ProfileEditValue>(
    () => ({
      isOwner,
      isSaving: mutation.isPending,
      save: async (patch) => {
        try {
          await mutation.mutateAsync(patch);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to save");
          throw err;
        }
      },
    }),
    [isOwner, mutation],
  );

  return (
    <ProfileEditContext.Provider value={value}>
      {children}
    </ProfileEditContext.Provider>
  );
}
