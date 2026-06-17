"use client";

import { useEffect } from "react";
import { useAuthModal } from "./auth-modal-context";
import AuthButton from "./auth-button";

export default function AuthModal() {
  const { open, closeModal } = useAuthModal();

  // Close on Escape key.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={closeModal}
    >
      {/* Panel — stop click propagation so clicks inside don't close the modal */}
      <div
        className="relative w-full max-w-sm rounded-2xl border border-border bg-bg p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={closeModal}
          aria-label="Close"
          className="absolute right-4 top-4 text-text-muted hover:text-text"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M2 2l12 12M14 2L2 14" />
          </svg>
        </button>

        <div className="mb-5 text-center">
          <h2 className="text-lg font-semibold text-text">Sign in to Narval</h2>
          <p className="mt-1 text-sm text-text-muted">
            Create an account or sign in to continue.
          </p>
        </div>

        <AuthButton onSuccess={closeModal} />
      </div>
    </div>
  );
}
