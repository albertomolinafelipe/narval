"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import type { UpdateStartupRequest } from "@/lib/api/gen";
import {
  useUpdateStartupMutation,
  useStartupImageMutation,
  type StartupImageKind,
} from "@/lib/api/use-startups-query";

interface ProfileEditValue {
  /** UX gate only — real authorization is enforced server-side (403 if not owner). */
  isOwner: boolean;
  isSaving: boolean;
  /** Persist a partial update. Callers pass only the field(s) they changed. */
  save: (patch: UpdateStartupRequest) => Promise<void>;
  /** Upload (or replace) the logo/banner with a cropped blob. */
  uploadImage: (kind: StartupImageKind, blob: Blob) => Promise<void>;
  /** Remove the logo/banner. */
  removeImage: (kind: StartupImageKind) => Promise<void>;
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
  const imageMutation = useStartupImageMutation(startupId);

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
      uploadImage: async (kind, blob) => {
        try {
          await imageMutation.mutateAsync({ kind, blob });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to upload");
          throw err;
        }
      },
      removeImage: async (kind) => {
        try {
          await imageMutation.mutateAsync({ kind, blob: null });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to remove");
          throw err;
        }
      },
    }),
    [isOwner, mutation, imageMutation],
  );

  return (
    <ProfileEditContext.Provider value={value}>
      {children}
    </ProfileEditContext.Provider>
  );
}
