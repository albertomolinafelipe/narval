"use client";

import { useAuthModal } from "./auth-modal-context";
import AuthButton from "./auth-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function AuthModal() {
  const { open, closeModal } = useAuthModal();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeModal()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in to Narval</DialogTitle>
          <DialogDescription>
            Create an account or sign in to continue.
          </DialogDescription>
        </DialogHeader>

        <AuthButton onSuccess={closeModal} />
      </DialogContent>
    </Dialog>
  );
}
